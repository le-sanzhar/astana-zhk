"""
Scoring service — traffic light scoring for 3 buyer profiles.
Profiles: investor, family, student
Scores: green, yellow, red
"""
from decimal import Decimal
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class ScoreResult:
    profile: str
    score: str          # 'green' | 'yellow' | 'red'
    score_value: float  # 0–10
    explanation: str


# ─────────────────────────────────────────────────────────────────
# Helper thresholds
# ─────────────────────────────────────────────────────────────────

PRICE_GROWTH_GREEN = 5.0   # % per month to qualify as green for investor
PRICE_GROWTH_YELLOW = 1.0

INVESTOR_LISTINGS_GREEN = 10   # min active listings for liquidity
INVESTOR_LISTINGS_YELLOW = 3

STUDENT_MAX_PRICE_GREEN = 25_000_000   # тенге total price
STUDENT_MAX_PRICE_YELLOW = 35_000_000

FAMILY_SCHOOL_GREEN = 500    # meters
FAMILY_SCHOOL_YELLOW = 1000
FAMILY_KINDER_GREEN = 500
FAMILY_KINDER_YELLOW = 1000


# ─────────────────────────────────────────────────────────────────
# Core scoring logic
# ─────────────────────────────────────────────────────────────────

def score_investor(
    price_snapshots: list,      # list of PriceSnapshot ORM objects, ordered by date asc
    listings_count: Optional[int],
    stage: Optional[str],
) -> ScoreResult:
    """Investor/flipper scoring: price growth + liquidity + stage."""

    reasons = []
    score_pts = 0.0  # 0–10

    # 1. Price growth
    growth_pct = None
    if len(price_snapshots) >= 2:
        p_old = float(price_snapshots[0].price_avg or 0)
        p_new = float(price_snapshots[-1].price_avg or 0)
        if p_old > 0:
            days = max(1, (price_snapshots[-1].recorded_at - price_snapshots[0].recorded_at).days)
            growth_pct = ((p_new - p_old) / p_old) * 100 * (30 / days)  # normalise to per month

    if growth_pct is not None:
        if growth_pct >= PRICE_GROWTH_GREEN:
            score_pts += 4
            reasons.append(f"🚀 Рост цены {growth_pct:.1f}%/мес")
        elif growth_pct >= PRICE_GROWTH_YELLOW:
            score_pts += 2
            reasons.append(f"📈 Умеренный рост {growth_pct:.1f}%/мес")
        else:
            reasons.append(f"📉 Слабая динамика {growth_pct:.1f}%/мес")
    else:
        score_pts += 1  # нейтральный балл при отсутствии истории
        reasons.append("📊 История цен недостаточна")

    # 2. Liquidity (listings count)
    cnt = listings_count or 0
    if cnt >= INVESTOR_LISTINGS_GREEN:
        score_pts += 3
        reasons.append(f"✅ Высокая ликвидность ({cnt} объявлений)")
    elif cnt >= INVESTOR_LISTINGS_YELLOW:
        score_pts += 1.5
        reasons.append(f"⚠️ Средняя ликвидность ({cnt} объявлений)")
    else:
        reasons.append(f"❌ Низкая ликвидность ({cnt} объявлений)")

    # 3. Stage
    stage_scores = {
        "commissioned": 3,       # уже сдан — можно сдавать/продавать
        "under_construction": 2, # строится — ещё подорожает
        "foundation": 1,         # котлован — высокий риск
        "planned": 0,
    }
    score_pts += stage_scores.get(stage or "", 1)
    stage_labels = {
        "commissioned": "🏢 Дом сдан",
        "under_construction": "🏗️ Строится",
        "foundation": "🕳️ Котлован — высокий риск",
        "planned": "📋 Проект — риск задержки",
    }
    reasons.append(stage_labels.get(stage or "", "❓ Стадия неизвестна"))

    score_val = min(score_pts, 10.0)
    color = "green" if score_val >= 6 else ("yellow" if score_val >= 3.5 else "red")

    return ScoreResult(
        profile="investor",
        score=color,
        score_value=round(score_val, 1),
        explanation=" · ".join(reasons),
    )


def score_family(
    infra: list,        # list of Infrastructure ORM objects
    stage: Optional[str],
    completion_date=None,
) -> ScoreResult:
    """Family scoring: schools, kindergartens, stage."""

    reasons = []
    score_pts = 0.0

    # Group infrastructure by type
    schools = [i for i in infra if i.type == "school"]
    kinders = [i for i in infra if i.type == "kindergarten"]
    hospitals = [i for i in infra if i.type == "hospital"]
    parks = [i for i in infra if i.type == "park"]

    # 1. School
    nearest_school = min((i.distance_meters or 9999) for i in schools) if schools else 9999
    if nearest_school <= FAMILY_SCHOOL_GREEN:
        score_pts += 3
        reasons.append(f"🏫 Школа в {nearest_school}м")
    elif nearest_school <= FAMILY_SCHOOL_YELLOW:
        score_pts += 1.5
        reasons.append(f"🏫 Школа в {nearest_school}м (далековато)")
    else:
        reasons.append("❌ Школы нет рядом")

    # 2. Kindergarten
    nearest_kinder = min((i.distance_meters or 9999) for i in kinders) if kinders else 9999
    if nearest_kinder <= FAMILY_KINDER_GREEN:
        score_pts += 3
        reasons.append(f"🧒 Детсад в {nearest_kinder}м")
    elif nearest_kinder <= FAMILY_KINDER_YELLOW:
        score_pts += 1.5
        reasons.append(f"🧒 Детсад в {nearest_kinder}м")
    else:
        reasons.append("❌ Детсада нет рядом")

    # 3. Stage / safety
    if stage == "commissioned":
        score_pts += 3
        reasons.append("✅ Дом сдан — можно заселяться")
    elif stage == "under_construction":
        score_pts += 1.5
        reasons.append("⏳ Строится — дождаться сдачи")
    elif stage == "foundation":
        score_pts += 0.5
        reasons.append("⚠️ Котлован — риск задержки")
    else:
        score_pts += 1

    # 4. Bonus
    if hospitals:
        score_pts += 0.5
        reasons.append("🏥 Больница рядом")
    if parks:
        score_pts += 0.5
        reasons.append("🌳 Парк рядом")

    score_val = min(score_pts, 10.0)
    color = "green" if score_val >= 6 else ("yellow" if score_val >= 3.5 else "red")

    return ScoreResult(
        profile="family",
        score=color,
        score_value=round(score_val, 1),
        explanation=" · ".join(reasons),
    )


def score_student(
    price_avg: Optional[Decimal],
    area_min: Optional[Decimal],
    infra: list,
    stage: Optional[str],
) -> ScoreResult:
    """Student/single scoring: entry price + transport."""

    reasons = []
    score_pts = 0.0

    # 1. Entry price (avg_price/m² * min_area)
    entry_price = None
    if price_avg and area_min:
        entry_price = float(price_avg) * float(area_min)
    elif price_avg:
        entry_price = float(price_avg) * 35  # assume studio ~35m²

    if entry_price is not None:
        if entry_price <= STUDENT_MAX_PRICE_GREEN:
            score_pts += 4
            reasons.append(f"💰 Доступная цена входа: ~{entry_price/1_000_000:.1f} млн тг")
        elif entry_price <= STUDENT_MAX_PRICE_YELLOW:
            score_pts += 2
            reasons.append(f"💸 Умеренная цена: ~{entry_price/1_000_000:.1f} млн тг")
        else:
            reasons.append(f"🔴 Дорого: ~{entry_price/1_000_000:.1f} млн тг")
    else:
        score_pts += 1
        reasons.append("❓ Цена не указана")

    # 2. Transport
    stops = [i for i in infra if i.type == "bus_stop"]
    metro = [i for i in infra if i.type == "metro"]

    nearest_stop = min((i.distance_meters or 9999) for i in stops) if stops else 9999
    has_metro = bool(metro and min(i.distance_meters or 9999 for i in metro) < 1000)

    if has_metro:
        score_pts += 4
        reasons.append("🚇 Метро рядом")
    elif nearest_stop <= 300:
        score_pts += 3
        reasons.append(f"🚌 Остановка в {nearest_stop}м")
    elif nearest_stop <= 700:
        score_pts += 1.5
        reasons.append(f"🚌 Остановка в {nearest_stop}м")
    else:
        reasons.append("❌ Транспорт далеко")

    # 3. Stage
    if stage == "commissioned":
        score_pts += 2
        reasons.append("✅ Готово к заселению")
    elif stage == "under_construction":
        score_pts += 1
        reasons.append("⏳ Строится")

    score_val = min(score_pts, 10.0)
    color = "green" if score_val >= 6 else ("yellow" if score_val >= 3.5 else "red")

    return ScoreResult(
        profile="student",
        score=color,
        score_value=round(score_val, 1),
        explanation=" · ".join(reasons),
    )


def compute_all_scores(
    price_snapshots: list,
    infra: list,
    stage: Optional[str],
    completion_date=None,
) -> List[ScoreResult]:
    """Compute all three profile scores for a complex."""
    latest_snapshot = price_snapshots[-1] if price_snapshots else None

    results = [
        score_investor(
            price_snapshots=price_snapshots,
            listings_count=latest_snapshot.listings_count if latest_snapshot else None,
            stage=stage,
        ),
        score_family(
            infra=infra,
            stage=stage,
            completion_date=completion_date,
        ),
        score_student(
            price_avg=latest_snapshot.price_avg if latest_snapshot else None,
            area_min=latest_snapshot.total_area_min if latest_snapshot else None,
            infra=infra,
            stage=stage,
        ),
    ]
    return results
