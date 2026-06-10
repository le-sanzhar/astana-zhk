"""
scoring.py — AstanaZhK Scoring Engine v2
=========================================
Непрерывный, percentile-based скоринг ЖК Астаны для 4 профилей покупателя.

Принципы:
  * Каждый фактор -> float [0, 1] через непрерывные функции (сигмоиды,
    кусочно-линейные нормировки), без дискретных порогов.
  * Факторы считаются относительно всего датасета (percentile rank),
    а не в абсолютных значениях.
  * Детерминированность: "сейчас" = максимальная дата снимка в датасете
    (никаких datetime.now(), никаких внешних запросов).
  * Полная обработка edge-cases: 0 снимков, None price, unknown developer,
    отсутствие координат/дедлайна -> нейтральный 0.5 + штраф к confidence.

Зависимости: только stdlib (Python 3.11).

Публичный API:
    score_complex(complex, all_complexes, profile, *, stats=None,
                  horizon_years=2.0) -> ScoreResult
    build_market_stats(all_complexes) -> MarketStats   # для батч-скоринга
"""

from __future__ import annotations

import json
import math
import statistics
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Optional

# ════════════════════════════════════════════════════════════════════
# КАЛИБРОВКА (Астана, актуализировать раз в квартал)
# ════════════════════════════════════════════════════════════════════

PALACE_OF_PEACE = (51.1282, 71.4306)   # Дворец мира и согласия (центр)
ENU = (51.1379, 71.4014)               # ЕНУ им. Гумилёва
KBTU = (51.0877, 71.3932)              # КБТУ (астанинский кампус)
STUDENT_HUBS = (ENU, KBTU)

# Крупные ТРЦ (координаты приблизительные — уточнить по 2GIS при интеграции)
MALLS: dict[str, tuple[float, float]] = {
    "Khan Shatyr":   (51.1326, 71.4036),
    "Mega Silk Way": (51.0890, 71.4023),
    "Keruen":        (51.1283, 71.4220),
    "Asia Park":     (51.1850, 71.4450),
    "Eurasia":       (51.1640, 71.4750),
}

CAL: dict[str, Any] = {
    "median_salary": 450_000,
    "mortgage_rate": 0.155,
    "mortgage_years": 20,
    "down_payment": 0.20,
    "payment_to_income": 0.45,
    "family_sqm": 50.0,
    "studio_sqm": 25.0,
    "stage_premium_total": 0.28,
    "stage_premium_remaining": {
        "planned": 1.00,
        "foundation": 1.00,
        "under_construction": 0.50,
        "commissioned": 0.00,
    },
    "capex_per_sqm": {
        "planned": 65_000,
        "foundation": 65_000,
        "under_construction": 100_000,
        "commissioned": 110_000,
    },
    "rent_per_sqm_month": {
        "Есильский": 5_500,
        "Алматинский": 4_600,
        "Сарыарка": 4_300,
        "Байконыр": 4_400,
        "Нура": 4_100,
        "Сарайшық": 4_000,
        "default": 4_300,
    },
    "target_yield": 0.06,
}

TONE_GREEN = 0.65
TONE_YELLOW = 0.40

VALID_PROFILES = ("investor", "family", "student", "flipper")

# ════════════════════════════════════════════════════════════════════
# РЕЗУЛЬТАТ
# ════════════════════════════════════════════════════════════════════


@dataclass(frozen=True)
class ScoreResult:
    score: float
    tone: str
    score_value: float
    confidence: float
    top_reason: str
    risk_flag: str
    breakdown: dict[str, float]


# ════════════════════════════════════════════════════════════════════
# МАТЕМАТИЧЕСКИЕ ПРИМИТИВЫ
# ════════════════════════════════════════════════════════════════════


def clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def lin(x: float, lo: float, hi: float) -> float:
    if hi == lo:
        return 0.5
    return clamp01((x - lo) / (hi - lo))


def fall(x: float, lo: float, hi: float) -> float:
    return 1.0 - lin(x, lo, hi)


def sigmoid(x: float, mid: float, k: float) -> float:
    z = -k * (x - mid)
    if z > 60:
        return 0.0
    if z < -60:
        return 1.0
    return 1.0 / (1.0 + math.exp(z))


def percentile_rank(x: float, sorted_values: list[float]) -> float:
    n = len(sorted_values)
    if n == 0:
        return 0.5
    less = equal = 0
    for v in sorted_values:
        if v < x:
            less += 1
        elif v == x:
            equal += 1
    return clamp01((less + 0.5 * equal) / n)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def annuity_payment(principal: float, annual_rate: float, years: int) -> float:
    r = annual_rate / 12.0
    n = years * 12
    if r <= 0:
        return principal / n
    return principal * r / (1.0 - (1.0 + r) ** (-n))


# ════════════════════════════════════════════════════════════════════
# ПАРСИНГ СЫРЫХ ДАННЫХ
# ════════════════════════════════════════════════════════════════════


def _parse_date(v: Any) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)):
        try:
            return datetime.utcfromtimestamp(float(v)).date()
        except (OverflowError, OSError, ValueError):
            return None
    if isinstance(v, str):
        s = v.strip().replace("Z", "+00:00")
        for fmt in (None, "%Y-%m-%d", "%d.%m.%Y"):
            try:
                return (datetime.fromisoformat(s) if fmt is None
                        else datetime.strptime(s, fmt)).date()
            except ValueError:
                continue
    return None


def _snapshots(c: dict) -> list[tuple[date, float]]:
    raw = c.get("price_snapshots")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            raw = None
    if not isinstance(raw, (list, tuple)):
        return []
    out: list[tuple[date, float]] = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        d = _parse_date(s.get("recorded_at"))
        p = s.get("price_sqm")
        if d is None or not isinstance(p, (int, float)) or p <= 0:
            continue
        out.append((d, float(p)))
    out.sort(key=lambda t: t[0])
    return out


def _latest_price(c: dict) -> Optional[float]:
    snaps = _snapshots(c)
    if snaps:
        return snaps[-1][1]
    p = c.get("price_sqm")
    return float(p) if isinstance(p, (int, float)) and p > 0 else None


def _coords(c: dict) -> Optional[tuple[float, float]]:
    lat, lng = c.get("lat"), c.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)) \
            and 40 < lat < 60 and 60 < lng < 90:
        return (float(lat), float(lng))
    return None


def _deadline(c: dict) -> Optional[date]:
    y, q = c.get("end_year"), c.get("end_quarter")
    if not isinstance(y, int) or not isinstance(q, int) or not (1 <= q <= 4):
        return None
    return date(y, 3 * q, 28)


def _stage(c: dict) -> str:
    s = c.get("construction_stage")
    return s if s in ("planned", "foundation", "under_construction",
                      "commissioned") else "under_construction"


# ════════════════════════════════════════════════════════════════════
# ВРЕМЕННЫЕ РЯДЫ ЦЕН
# ════════════════════════════════════════════════════════════════════

MIN_SPAN_DAYS = 30


def _cagr(snaps: list[tuple[date, float]]) -> Optional[float]:
    if len(snaps) < 2:
        return None
    (d0, p0), (d1, p1) = snaps[0], snaps[-1]
    days = (d1 - d0).days
    if days < MIN_SPAN_DAYS or p0 <= 0:
        return None
    g = (p1 / p0) ** (365.0 / days) - 1.0
    return max(-0.5, min(1.0, g))


def _volatility(snaps: list[tuple[date, float]]) -> float:
    if len(snaps) < 3:
        return 0.0
    rets = [(p1 - p0) / p0 for (_, p0), (_, p1) in zip(snaps, snaps[1:]) if p0 > 0]
    if len(rets) < 2:
        return 0.0
    return float(statistics.pstdev(rets))


def _momentum(snaps: list[tuple[date, float]]) -> Optional[float]:
    if len(snaps) < 4:
        return None
    mid = len(snaps) // 2
    early, late = _cagr(snaps[: mid + 1]), _cagr(snaps[mid:])
    if early is None or late is None:
        return None
    return late - early


# ════════════════════════════════════════════════════════════════════
# РЫНОЧНАЯ СТАТИСТИКА
# ════════════════════════════════════════════════════════════════════


@dataclass
class MarketStats:
    now: date
    prices_sorted: list[float] = field(default_factory=list)
    snap_counts_sorted: list[float] = field(default_factory=list)
    adj_cagrs_sorted: list[float] = field(default_factory=list)
    district_prices: dict[str, list[float]] = field(default_factory=dict)
    district_median: dict[str, float] = field(default_factory=dict)
    district_cv: dict[str, float] = field(default_factory=dict)
    district_cv_sorted: list[float] = field(default_factory=list)
    dev_reliability: dict[str, tuple[float, int]] = field(default_factory=dict)
    median_price: float = 0.0


def build_market_stats(all_complexes: list[dict]) -> MarketStats:
    dates = [d for c in all_complexes for d, _ in _snapshots(c)]
    now = max(dates) if dates else date(2026, 1, 1)
    st = MarketStats(now=now)

    prices, counts, adj = [], [], []
    by_district: dict[str, list[float]] = {}
    dev_resolved: dict[str, list[bool]] = {}

    for c in all_complexes:
        snaps = _snapshots(c)
        counts.append(float(len(snaps)))
        p = _latest_price(c)
        if p is not None:
            prices.append(p)
            d = c.get("district") or "unknown"
            by_district.setdefault(d, []).append(p)
        g = _cagr(snaps)
        if g is not None:
            adj.append(g - 0.5 * _volatility(snaps))

        dev = c.get("developer")
        dl = _deadline(c)
        if dev and dl is not None and dl <= now:
            dev_resolved.setdefault(dev, []).append(_stage(c) == "commissioned")

    st.prices_sorted = sorted(prices)
    st.snap_counts_sorted = sorted(counts)
    st.adj_cagrs_sorted = sorted(adj)
    st.median_price = statistics.median(prices) if prices else 0.0
    st.district_prices = by_district

    cvs = []
    for d, ps in by_district.items():
        st.district_median[d] = statistics.median(ps)
        if len(ps) >= 3:
            mean = statistics.fmean(ps)
            cv = statistics.pstdev(ps) / mean if mean > 0 else 0.0
            st.district_cv[d] = cv
            cvs.append(cv)
    st.district_cv_sorted = sorted(cvs)

    for dev, flags in dev_resolved.items():
        rate = (sum(flags) + 1.0) / (len(flags) + 2.0)
        st.dev_reliability[dev] = (rate, len(flags))

    return st


_STATS_CACHE: dict[int, MarketStats] = {}


def _get_stats(all_complexes: list[dict],
               stats: Optional[MarketStats]) -> MarketStats:
    if stats is not None:
        return stats
    key = id(all_complexes)
    cached = _STATS_CACHE.get(key)
    if cached is None:
        cached = build_market_stats(all_complexes)
        _STATS_CACHE.clear()
        _STATS_CACHE[key] = cached
    return cached


# ════════════════════════════════════════════════════════════════════
# КОНТЕКСТ ОДНОГО ЖК
# ════════════════════════════════════════════════════════════════════


@dataclass
class _Ctx:
    price: Optional[float]
    snaps: list[tuple[date, float]]
    cagr: Optional[float]
    vol: float
    momentum: Optional[float]
    stage: str
    district: str
    coords: Optional[tuple[float, float]]
    deadline: Optional[date]
    quarters_to_deadline: Optional[float]
    dev_rel: Optional[tuple[float, int]]


def _make_ctx(c: dict, st: MarketStats) -> _Ctx:
    snaps = _snapshots(c)
    dl = _deadline(c)
    qtd = (dl - st.now).days / 91.25 if dl is not None else None
    dev = c.get("developer")
    return _Ctx(
        price=_latest_price(c),
        snaps=snaps,
        cagr=_cagr(snaps),
        vol=_volatility(snaps),
        momentum=_momentum(snaps),
        stage=_stage(c),
        district=c.get("district") or "unknown",
        coords=_coords(c),
        deadline=dl,
        quarters_to_deadline=qtd,
        dev_rel=st.dev_reliability.get(dev) if dev else None,
    )


def _premium_remaining(ctx: _Ctx) -> float:
    share = CAL["stage_premium_remaining"].get(ctx.stage, 0.5)
    return CAL["stage_premium_total"] * share


def _rent_sqm(district: str) -> float:
    table = CAL["rent_per_sqm_month"]
    return float(table.get(district, table["default"]))


# ════════════════════════════════════════════════════════════════════
# ФАКТОРЫ: INVESTOR
# ════════════════════════════════════════════════════════════════════


def _f_investor(ctx: _Ctx, st: MarketStats) -> dict[str, float]:
    f: dict[str, float] = {}

    if ctx.cagr is not None:
        adj = ctx.cagr - 0.5 * ctx.vol
        f["cagr"] = 0.6 * percentile_rank(adj, st.adj_cagrs_sorted) \
                  + 0.4 * sigmoid(adj, mid=0.07, k=18)
    else:
        f["cagr"] = 0.5

    f["momentum"] = sigmoid(ctx.momentum, mid=0.0, k=10) \
        if ctx.momentum is not None else 0.5

    rem = _premium_remaining(ctx)
    if ctx.quarters_to_deadline is not None and ctx.quarters_to_deadline > 0.5:
        per_year = rem / (ctx.quarters_to_deadline / 4.0)
        f["stage_premium"] = 0.6 * lin(rem, 0.0, 0.30) + 0.4 * lin(per_year, 0.0, 0.25)
    else:
        f["stage_premium"] = 0.6 * lin(rem, 0.0, 0.30) + 0.4 * (0.5 if rem > 0 else 0.0)

    if ctx.price:
        y = _rent_sqm(ctx.district) * 12.0 / ctx.price
        f["rental_yield"] = lin(y, 0.03, 0.09)
    else:
        f["rental_yield"] = 0.5

    f["developer"] = ctx.dev_rel[0] if ctx.dev_rel else 0.5
    f["liquidity"] = percentile_rank(float(len(ctx.snaps)), st.snap_counts_sorted)
    return f


def _investor_weights(horizon_years: float) -> dict[str, float]:
    short = {"cagr": 0.20, "momentum": 0.26, "stage_premium": 0.12,
             "rental_yield": 0.12, "developer": 0.14, "liquidity": 0.16}
    long_ = {"cagr": 0.30, "momentum": 0.06, "stage_premium": 0.22,
             "rental_yield": 0.20, "developer": 0.14, "liquidity": 0.08}
    t = clamp01((horizon_years - 1.0) / 2.0)
    return {k: short[k] * (1 - t) + long_[k] * t for k in short}


# ════════════════════════════════════════════════════════════════════
# ФАКТОРЫ: FAMILY
# ════════════════════════════════════════════════════════════════════

_STAGE_RISK = {"commissioned": 0.03, "under_construction": 0.35,
               "foundation": 0.55, "planned": 0.65}


def _f_family(ctx: _Ctx, st: MarketStats) -> dict[str, float]:
    f: dict[str, float] = {}

    risk = _STAGE_RISK[ctx.stage]
    rel = ctx.dev_rel[0] if ctx.dev_rel else 0.5
    risk *= (1.4 - 0.8 * rel)
    if ctx.quarters_to_deadline is not None:
        if ctx.quarters_to_deadline < 0 and ctx.stage != "commissioned":
            risk += 0.25
        elif ctx.quarters_to_deadline > 10:
            risk += 0.10
    f["completion_risk"] = 1.0 - clamp01(risk)

    if ctx.price:
        loan = ctx.price * CAL["family_sqm"] * (1.0 - CAL["down_payment"])
        pay = annuity_payment(loan, CAL["mortgage_rate"], CAL["mortgage_years"])
        ratio = pay / (CAL["payment_to_income"] * CAL["median_salary"])
        f["affordability"] = sigmoid(ratio, mid=1.0, k=-3.0)
    else:
        f["affordability"] = 0.5

    if ctx.coords:
        d_center = haversine_km(ctx.coords, PALACE_OF_PEACE)
        d_mall = min(haversine_km(ctx.coords, m) for m in MALLS.values())
        f["infrastructure"] = 0.5 * fall(d_center, 1.5, 12.0) \
                            + 0.5 * fall(d_mall, 0.5, 6.0)
    else:
        f["infrastructure"] = 0.5

    cv = st.district_cv.get(ctx.district)
    f["stability"] = 1.0 - percentile_rank(cv, st.district_cv_sorted) \
        if cv is not None else 0.5

    if ctx.price and st.prices_sorted:
        f["size_signal"] = lin(percentile_rank(ctx.price, st.prices_sorted), 0.10, 0.45)
    else:
        f["size_signal"] = 0.5
    return f


_FAMILY_W = {"completion_risk": 0.30, "affordability": 0.25,
             "infrastructure": 0.20, "stability": 0.15, "size_signal": 0.10}


# ════════════════════════════════════════════════════════════════════
# ФАКТОРЫ: STUDENT
# ════════════════════════════════════════════════════════════════════


def _f_student(ctx: _Ctx, st: MarketStats) -> dict[str, float]:
    f: dict[str, float] = {}

    if ctx.price and st.prices_sorted:
        f["affordability_pct"] = 1.0 - percentile_rank(ctx.price, st.prices_sorted)
    else:
        f["affordability_pct"] = 0.5

    f["entry_barrier"] = fall(ctx.price * CAL["studio_sqm"], 8e6, 20e6) \
        if ctx.price else 0.5

    if ctx.coords:
        d = min(haversine_km(ctx.coords, h) for h in STUDENT_HUBS)
        f["student_hub"] = fall(d, 1.0, 10.0)
    else:
        f["student_hub"] = 0.5

    if ctx.stage == "commissioned":
        f["readiness"] = 1.0
    elif ctx.stage == "under_construction":
        q = ctx.quarters_to_deadline if ctx.quarters_to_deadline is not None else 4.0
        f["readiness"] = clamp01(0.60 - 0.05 * max(q, 0.0))
    elif ctx.stage == "foundation":
        f["readiness"] = 0.12
    else:
        f["readiness"] = 0.05
    return f


_STUDENT_W = {"affordability_pct": 0.50, "entry_barrier": 0.20,
              "student_hub": 0.18, "readiness": 0.12}


# ════════════════════════════════════════════════════════════════════
# ФАКТОРЫ: FLIPPER
# ════════════════════════════════════════════════════════════════════


def _f_flipper(ctx: _Ctx, st: MarketStats, all_complexes: list[dict]) -> dict[str, float]:
    f: dict[str, float] = {}
    dist_med = st.district_median.get(ctx.district)

    if ctx.price and dist_med:
        margin = (dist_med - ctx.price) / ctx.price
        f["gross_margin"] = sigmoid(margin, mid=0.0, k=14)
    else:
        f["gross_margin"] = 0.5

    rem = _premium_remaining(ctx)
    if ctx.quarters_to_deadline is not None and ctx.quarters_to_deadline > 0.5:
        per_q = rem / ctx.quarters_to_deadline
        f["stage_timing"] = 0.5 * lin(rem, 0.0, 0.30) + 0.5 * lin(per_q, 0.0, 0.06)
    else:
        f["stage_timing"] = 0.5 * lin(rem, 0.0, 0.30)

    capex = CAL["capex_per_sqm"][ctx.stage]
    f["capex"] = fall(capex / ctx.price, 0.05, 0.30) if ctx.price else 0.5

    if ctx.price:
        entry = ctx.price
        if ctx.stage == "commissioned":
            exit_p = max(dist_med or entry, entry * 1.02)
            years = 0.75
        else:
            exit_p = entry * (1.0 + rem)
            q = ctx.quarters_to_deadline if (ctx.quarters_to_deadline or 0) > 0 else 4.0
            years = max(q / 4.0 + 0.5, 0.75)
        irr = (exit_p - entry - capex) / entry / years
        f["irr"] = lin(irr, 0.0, 0.35)
    else:
        f["irr"] = 0.5

    if ctx.price:
        comps = -1
        for other in all_complexes:
            if (other.get("district") or "unknown") != ctx.district:
                continue
            p = _latest_price(other)
            if p is not None and abs(p - ctx.price) <= 0.15 * ctx.price:
                comps += 1
        comps = max(comps, 0)
        if comps <= 4:
            f["segment_liquidity"] = 0.30 + 0.175 * comps
        elif comps <= 10:
            f["segment_liquidity"] = 1.0
        else:
            f["segment_liquidity"] = max(0.35, 1.0 - 0.045 * (comps - 10))
    else:
        f["segment_liquidity"] = 0.5
    return f


_FLIPPER_W = {"gross_margin": 0.25, "stage_timing": 0.20, "capex": 0.15,
              "irr": 0.25, "segment_liquidity": 0.15}


# ════════════════════════════════════════════════════════════════════
# CONFIDENCE, REASONS, СБОРКА
# ════════════════════════════════════════════════════════════════════


def _confidence(ctx: _Ctx) -> float:
    n = len(ctx.snaps)
    conf = 1.0 if n >= 6 else 0.80 if n >= 3 else 0.55 if n >= 1 else 0.30
    if ctx.price is None:
        conf *= 0.50
    if ctx.dev_rel is None:
        conf *= 0.90
    if ctx.coords is None:
        conf *= 0.88
    if ctx.deadline is None:
        conf *= 0.92
    return round(max(conf, 0.05), 2)


_LABELS = {
    "cagr": "темп роста цены (CAGR с поправкой на волатильность)",
    "momentum": "момент роста (тренд ускоряется/замедляется)",
    "stage_premium": "оставшийся апсайд стадии строительства",
    "rental_yield": "арендная доходность",
    "developer": "надёжность застройщика по срокам сдачи",
    "liquidity": "активность продаж (частота обновления цен)",
    "completion_risk": "риск недостроя/задержки",
    "affordability": "доступность ипотеки для семьи",
    "infrastructure": "близость центра и ТРЦ",
    "stability": "стабильность цен в районе",
    "size_signal": "класс жилья (сигнал по цене/м²)",
    "affordability_pct": "позиция в рейтинге доступности",
    "entry_barrier": "порог входа (стоимость студии)",
    "student_hub": "близость к ЕНУ/КБТУ",
    "readiness": "готовность к заселению",
    "gross_margin": "дисконт к медиане района",
    "stage_timing": "тайминг апсайда до сдачи",
    "capex": "затраты на ремонт",
    "irr": "оценка IRR сделки",
    "segment_liquidity": "ликвидность сегмента при перепродаже",
}


def _reasons(breakdown: dict[str, float],
             weights: dict[str, float]) -> tuple[str, str]:
    contrib = {k: weights[k] * (v - 0.5) for k, v in breakdown.items()}
    top = max(contrib, key=contrib.get)
    low = min(contrib, key=contrib.get)
    return f"{_LABELS[top]}: {breakdown[top]:.2f}", \
           f"{_LABELS[low]}: {breakdown[low]:.2f}"


def score_complex(complex: dict,
                  all_complexes: list[dict],
                  profile: str,
                  *,
                  stats: Optional[MarketStats] = None,
                  horizon_years: float = 2.0) -> ScoreResult:
    """
    complex        — dict одного ЖК
    all_complexes  — весь датасет (для percentile-ранжирования)
    profile        — investor | family | student | flipper
    stats          — передавать при батч-скоринге (build_market_stats())
    horizon_years  — горизонт инвестора: 1.0 краткосрочный, 3.0+ долгосрочный
    """
    if profile not in VALID_PROFILES:
        raise ValueError(f"unknown profile {profile!r}")

    st = _get_stats(all_complexes, stats)
    ctx = _make_ctx(complex, st)

    if profile == "investor":
        breakdown = _f_investor(ctx, st)
        weights = _investor_weights(horizon_years)
    elif profile == "family":
        breakdown, weights = _f_family(ctx, st), _FAMILY_W
    elif profile == "student":
        breakdown, weights = _f_student(ctx, st), _STUDENT_W
    else:
        breakdown, weights = _f_flipper(ctx, st, all_complexes), _FLIPPER_W

    score = clamp01(sum(weights[k] * v for k, v in breakdown.items())
                    / sum(weights.values()))
    tone = "green" if score >= TONE_GREEN else \
           "yellow" if score >= TONE_YELLOW else "red"
    top_reason, risk_flag = _reasons(breakdown, weights)

    return ScoreResult(
        score=round(score, 4),
        tone=tone,
        score_value=round(score * 10.0, 1),
        confidence=_confidence(ctx),
        top_reason=top_reason,
        risk_flag=risk_flag,
        breakdown={k: round(v, 3) for k, v in breakdown.items()},
    )


# ════════════════════════════════════════════════════════════════════
# МЕТОДОЛОГИЯ — для UI-объяснения скоринга
# ════════════════════════════════════════════════════════════════════

_METHODOLOGY: dict = {
    "version": "2.0",
    "how_it_works": (
        "Каждый фактор нормируется в диапазон 0–1 через непрерывные функции "
        "(сигмоиды, кусочно-линейные нормировки). Значения считаются относительно "
        "всего датасета (256 ЖК) — percentile rank. Итоговый score = взвешенная сумма "
        "факторов. Тон: зелёный ≥ 6.5, жёлтый ≥ 4.0, красный < 4.0."
    ),
    "confidence_note": (
        "Confidence снижается при малом числе ценовых снимков, отсутствии координат, "
        "дедлайна или данных о застройщике. При confidence < 0.5 оценку стоит "
        "воспринимать как ориентировочную."
    ),
    "profiles": {
        "investor": {
            "label": "Инвестор",
            "description": "Приоритет — рост стоимости и доходность от аренды. Горизонт 1–3 года.",
            "factors": [
                {
                    "key": "cagr",
                    "label": "Темп роста цены (CAGR)",
                    "weight": 0.25,
                    "weight_pct": "25%",
                    "how": "Аннуализированный рост цены/м² со штрафом за волатильность ряда. Percentile по датасету + сигмоида вокруг 7%/год.",
                    "good": "Стабильный рост > 10%/год",
                    "bad": "Рост < 2%/год или «пила» (высокая волатильность)",
                },
                {
                    "key": "momentum",
                    "label": "Моментум (тренд)",
                    "weight": 0.16,
                    "weight_pct": "16%",
                    "how": "Разность CAGR второй и первой половины ряда снимков. Положительный — рост ускоряется.",
                    "good": "Темп роста ускоряется",
                    "bad": "Рост замедляется (mean reversion)",
                },
                {
                    "key": "stage_premium",
                    "label": "Апсайд стадии",
                    "weight": 0.17,
                    "weight_pct": "17%",
                    "how": "Оставшийся апсайд котлован→сдача (+28% исторически). Котлован с близкой сдачей — максимум.",
                    "good": "Котлован с дедлайном через 4–8 кварталов",
                    "bad": "Сданный ЖК — апсайда нет",
                },
                {
                    "key": "rental_yield",
                    "label": "Арендная доходность",
                    "weight": 0.16,
                    "weight_pct": "16%",
                    "how": "Медиана аренды района × 12 / цена/м². Целевой yield 6%. Нормировка на диапазон 3–9%.",
                    "good": "Yield > 7% (дешёвый ЖК в активном районе)",
                    "bad": "Yield < 4% (дорогой ЖК, аренда не отбивает)",
                },
                {
                    "key": "developer",
                    "label": "Надёжность застройщика",
                    "weight": 0.14,
                    "weight_pct": "14%",
                    "how": "Доля сданных в срок ЖК этого застройщика по датасету. Сглаживание Лапласа при малой истории.",
                    "good": "Застройщик сдал > 80% в срок",
                    "bad": "Нет истории или задержки",
                },
                {
                    "key": "liquidity",
                    "label": "Ликвидность / активность",
                    "weight": 0.12,
                    "weight_pct": "12%",
                    "how": "Percentile по числу ценовых снимков — proxy активности продаж и интереса рынка.",
                    "good": "Много снимков — активный спрос",
                    "bad": "Мало данных — непопулярный или новый объект",
                },
            ],
        },
        "family": {
            "label": "Семья",
            "description": "Приоритет — безопасность сделки, доступность ипотеки, инфраструктура.",
            "factors": [
                {
                    "key": "completion_risk",
                    "label": "Риск недостроя",
                    "weight": 0.30,
                    "weight_pct": "30%",
                    "how": "Базовый риск по стадии × поправка на надёжность застройщика. Штраф за просроченный дедлайн.",
                    "good": "Сданный ЖК от надёжного застройщика",
                    "bad": "Котлован с просроченным дедлайном",
                },
                {
                    "key": "affordability",
                    "label": "Доступность ипотеки",
                    "weight": 0.25,
                    "weight_pct": "25%",
                    "how": "Аннуитет за 50 м² (15.5% ставка, 20 лет, 20% взнос) / 45% медианной зарплаты Астаны (450k ₸).",
                    "good": "Платёж ≤ 45% дохода",
                    "bad": "Платёж > 80% дохода",
                },
                {
                    "key": "infrastructure",
                    "label": "Инфраструктура",
                    "weight": 0.20,
                    "weight_pct": "20%",
                    "how": "Расстояние до центра города (Дворец мира) и ближайшего ТРЦ. Haversine по координатам.",
                    "good": "< 3 км до центра и < 1 км до ТРЦ",
                    "bad": "> 10 км от центра",
                },
                {
                    "key": "stability",
                    "label": "Стабильность района",
                    "weight": 0.15,
                    "weight_pct": "15%",
                    "how": "Коэффициент вариации цен в районе — низкий CV = предсказуемый рынок.",
                    "good": "Низкая дисперсия (Есильский, Нура)",
                    "bad": "Высокая дисперсия цен",
                },
                {
                    "key": "size_signal",
                    "label": "Класс жилья",
                    "weight": 0.10,
                    "weight_pct": "10%",
                    "how": "Цена/м² относительно датасета. Слишком дёшево = мелкая нарезка/эконом. Среднерыночный сегмент — максимум.",
                    "good": "Средний ценовой сегмент",
                    "bad": "Аномально дёшево (мелкая студия) или очень дорого",
                },
            ],
        },
        "student": {
            "label": "Студент",
            "description": "Приоритет — минимальный порог входа, близость к университетам, возможность заселения.",
            "factors": [
                {
                    "key": "affordability_pct",
                    "label": "Доступность (рейтинг)",
                    "weight": 0.50,
                    "weight_pct": "50%",
                    "how": "1 − percentile цены по датасету. Самые дешёвые ЖК получают максимум.",
                    "good": "Цена/м² в нижних 20% датасета",
                    "bad": "Цена выше медианы",
                },
                {
                    "key": "entry_barrier",
                    "label": "Порог входа (студия)",
                    "weight": 0.20,
                    "weight_pct": "20%",
                    "how": "Цена/м² × 25 м² (минимальная студия). Нормировка: 8 млн ₸ → отлично, 20 млн ₸ → недоступно.",
                    "good": "Студия < 10 млн ₸",
                    "bad": "Студия > 18 млн ₸",
                },
                {
                    "key": "student_hub",
                    "label": "Близость к ЕНУ/КБТУ",
                    "weight": 0.18,
                    "weight_pct": "18%",
                    "how": "Минимальное расстояние до ЕНУ им. Гумилёва или КБТУ по haversine.",
                    "good": "< 2 км до кампуса",
                    "bad": "> 8 км",
                },
                {
                    "key": "readiness",
                    "label": "Готовность к заселению",
                    "weight": 0.12,
                    "weight_pct": "12%",
                    "how": "Сданный → 1.0. Строящийся → снижается пропорционально кварталам до сдачи.",
                    "good": "Сдан или сдача через 1–2 квартала",
                    "bad": "Котлован — ждать 3+ года",
                },
            ],
        },
        "flipper": {
            "label": "Флиппер",
            "description": "Приоритет — маржа сделки, скорость выхода, минимальный capex.",
            "factors": [
                {
                    "key": "irr",
                    "label": "Оценка IRR",
                    "weight": 0.25,
                    "weight_pct": "25%",
                    "how": "(цена выхода − цена входа − capex ремонта) / цена входа / годы. Нормировка 0–35%/год.",
                    "good": "IRR > 25%/год",
                    "bad": "IRR < 5%/год",
                },
                {
                    "key": "gross_margin",
                    "label": "Дисконт к медиане района",
                    "weight": 0.25,
                    "weight_pct": "25%",
                    "how": "(медиана района − цена) / цена. Сигмоида вокруг нуля. Дисконт = потенциал роста при выходе.",
                    "good": "Цена на 15–25% ниже медианы района",
                    "bad": "Цена выше медианы — маржа отрицательная",
                },
                {
                    "key": "stage_timing",
                    "label": "Тайминг апсайда",
                    "weight": 0.20,
                    "weight_pct": "20%",
                    "how": "Оставшийся апсайд стадии × скорость его реализации (апсайд/квартал).",
                    "good": "Котлован с коротким сроком сдачи",
                    "bad": "Сданный ЖК или сдача через > 12 кварталов",
                },
                {
                    "key": "capex",
                    "label": "Затраты на ремонт",
                    "weight": 0.15,
                    "weight_pct": "15%",
                    "how": "Capex/м² по стадии: котлован 65k, строится 100k, сдан 110k. Нормировка как % от цены входа.",
                    "good": "Котлован/чистовая отделка — минимальный capex",
                    "bad": "Сданный ЖК требует полного ремонта",
                },
                {
                    "key": "segment_liquidity",
                    "label": "Ликвидность сегмента",
                    "weight": 0.15,
                    "weight_pct": "15%",
                    "how": "Число ЖК в том же районе в диапазоне ±15% цены. Перевёрнутая U: 5–10 аналогов — оптимум.",
                    "good": "5–10 конкурентов (живой рынок)",
                    "bad": "0 аналогов (нет рынка) или 20+ (затоваривание)",
                },
            ],
        },
    },
}


def get_scoring_info() -> dict:
    """Return scoring methodology metadata for UI display."""
    return _METHODOLOGY
