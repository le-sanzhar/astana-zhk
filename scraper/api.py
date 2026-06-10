"""
Lightweight FastAPI over the korter.kz scraper SQLite.
Serves ComplexItem-compatible JSON for the AstanaZhK mobile app.

Run:
    cd AstanaZhK
    uvicorn scraper.api:app --reload --port 8001
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .scoring import MarketStats, ScoreResult, build_market_stats, get_scoring_info, score_complex

DB_PATH = Path(__file__).parent / "astana_zhk.db"

app = FastAPI(title="Korter Scraper API", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ── DB ────────────────────────────────────────────────────────────────────────

@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ── Dataset cache (all complexes + MarketStats, rebuilt on startup) ───────────

_ALL_COMPLEXES: list[dict] = []
_MARKET_STATS: Optional[MarketStats] = None


def _load_dataset() -> tuple[list[dict], MarketStats]:
    """Load all complexes with snapshots from DB. Cached in module globals."""
    global _ALL_COMPLEXES, _MARKET_STATS
    if _ALL_COMPLEXES and _MARKET_STATS:
        return _ALL_COMPLEXES, _MARKET_STATS

    with _db() as conn:
        rows = conn.execute("""
            SELECT c.*,
                (SELECT price_sqm FROM price_snapshots
                 WHERE complex_id = c.id AND price_sqm IS NOT NULL
                 ORDER BY recorded_at DESC LIMIT 1) AS price_sqm
            FROM complexes c
        """).fetchall()

        dataset: list[dict] = []
        for row in rows:
            d = dict(row)
            snaps = conn.execute(
                "SELECT price_sqm, recorded_at FROM price_snapshots "
                "WHERE complex_id=? AND price_sqm IS NOT NULL ORDER BY recorded_at ASC",
                (d["id"],),
            ).fetchall()
            d["price_snapshots"] = [
                {"price_sqm": s["price_sqm"], "recorded_at": s["recorded_at"]}
                for s in snaps
            ]
            dataset.append(d)

    _ALL_COMPLEXES = dataset
    _MARKET_STATS = build_market_stats(dataset)
    return _ALL_COMPLEXES, _MARKET_STATS


@app.on_event("startup")
def _startup():
    _load_dataset()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _monthly_payment(price_sqm: float, area: float = 60.0) -> int:
    """Otbasy Bank: 15.5% annual, 20 yr, 20% down."""
    loan = price_sqm * area * 0.80
    r = 0.155 / 12
    n = 240
    return round(loan * r * (1 + r) ** n / ((1 + r) ** n - 1))


def _move_in(stage: str, year: Optional[int], quarter: Optional[int]) -> str:
    if stage == "commissioned":
        return "Сдан"
    if year and quarter:
        return f"Q{quarter} {year}"
    return str(year) if year else "В разработке"


_FALLBACK_IMG = (
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00"
    "?auto=format&fit=crop&w=1200&q=80"
)


def _build_item(
    row: dict,
    all_complexes: list[dict],
    stats: MarketStats,
) -> dict:
    price = float(row["price_sqm"]) if row["price_sqm"] else None
    stage = row.get("construction_stage") or "commissioned"
    district = row.get("district") or ""

    # score_complex uses row["price_snapshots"] already set in _load_dataset
    results: dict[str, ScoreResult] = {
        p: score_complex(row, all_complexes, p, stats=stats)
        for p in ("investor", "family", "student", "flipper")
    }

    price_history = [
        {"price_avg": s["price_sqm"], "recorded_at": s["recorded_at"]}
        for s in (row.get("price_snapshots") or [])
    ]

    img = row.get("image_url") or _FALLBACK_IMG
    try:
        gallery: list[str] = json.loads(row["images_json"]) if row.get("images_json") else []
    except (TypeError, ValueError):
        gallery = []
    if not gallery:
        gallery = [img]

    return {
        "id": str(row["korter_id"]),
        "name": row["name"],
        "developer": row.get("developer") or "",
        "address": row.get("address") or "",
        "district": district,
        "price_avg": price or 0,
        "construction_stage": stage,
        # v1 tone fields (backward compat)
        "investor_score": results["investor"].tone,
        "family_score": results["family"].tone,
        "student_score": results["student"].tone,
        "flipper_score": results["flipper"].tone,
        # v2 numeric scores
        "investor_score_value": results["investor"].score_value,
        "family_score_value": results["family"].score_value,
        "student_score_value": results["student"].score_value,
        "flipper_score_value": results["flipper"].score_value,
        "image": img,
        "gallery": gallery,
        "rating": 0.0,
        "review_count": 0,
        "price_monthly": _monthly_payment(price) if price else 0,
        "bedrooms": 2,
        "bathrooms": 1,
        "area_sqm": 60,
        "tagline": row["name"],
        "description": row.get("address") or "",
        "move_in": _move_in(stage, row.get("end_year"), row.get("end_quarter")),
        "agent": {"name": "", "role": row.get("developer") or "", "avatar": ""},
        "price_snapshots": price_history,
        "scores": [
            {
                "profile": p,
                "score": results[p].tone,
                "score_value": results[p].score_value,
                "confidence": results[p].confidence,
                "top_reason": results[p].top_reason,
                "risk_flag": results[p].risk_flag,
                "breakdown": results[p].breakdown,
                "explanation": results[p].top_reason,
            }
            for p in ("investor", "family", "student", "flipper")
        ],
        "ai_summary": "",
        "infrastructure": [],
        "krisha_url": row.get("korter_url") or "",
        "coordinates": {
            "lat": float(row["lat"]) if row.get("lat") else 0.0,
            "lng": float(row["lng"]) if row.get("lng") else 0.0,
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "db": str(DB_PATH), "complexes": len(_ALL_COMPLEXES)}


@app.get("/api/v1/complexes")
def list_complexes(
    district: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    all_complexes, stats = _load_dataset()

    items = []
    for row in all_complexes:
        if not row.get("price_sqm"):
            continue
        price = float(row["price_sqm"])
        if district and row.get("district") != district:
            continue
        if stage and row.get("construction_stage") != stage:
            continue
        if min_price and price < min_price:
            continue
        if max_price and price > max_price:
            continue
        items.append(_build_item(row, all_complexes, stats))

    return {"total": len(items), "items": items[offset: offset + limit]}


@app.get("/api/v1/complexes/{korter_id}")
def get_complex(korter_id: int):
    all_complexes, stats = _load_dataset()
    row = next((c for c in all_complexes if c.get("korter_id") == korter_id), None)
    if not row:
        raise HTTPException(404, "Комплекс не найден")
    return _build_item(row, all_complexes, stats)


@app.get("/api/v1/scoring-info")
def scoring_info():
    return get_scoring_info()


@app.get("/api/v1/stats")
def get_stats():
    with _db() as conn:
        return {
            "total_complexes": conn.execute("SELECT COUNT(*) FROM complexes").fetchone()[0],
            "complexes_with_price": conn.execute(
                "SELECT COUNT(DISTINCT complex_id) FROM price_snapshots"
            ).fetchone()[0],
            "total_snapshots": conn.execute("SELECT COUNT(*) FROM price_snapshots").fetchone()[0],
            "total_alerts": conn.execute("SELECT COUNT(*) FROM price_alerts").fetchone()[0],
            "last_run": conn.execute("SELECT MAX(recorded_at) FROM price_snapshots").fetchone()[0],
        }


@app.get("/api/v1/notifications")
def get_notifications(days: int = Query(7, ge=1, le=30)):
    with _db() as conn:
        rows = conn.execute("""
            SELECT pa.id, pa.complex_name, pa.old_price_sqm, pa.new_price_sqm,
                   pa.delta_pct, pa.triggered_at, c.korter_id
            FROM price_alerts pa
            JOIN complexes c ON c.id = pa.complex_id
            WHERE pa.triggered_at >= datetime('now', ?)
            ORDER BY pa.triggered_at DESC
        """, (f"-{days} days",)).fetchall()

        return [
            {
                "id": str(row["id"]),
                "complexId": str(row["korter_id"]),
                "complexName": row["complex_name"],
                "message": (
                    f"Цена {'выросла' if row['delta_pct'] > 0 else 'упала'} на "
                    f"{abs(row['new_price_sqm'] - row['old_price_sqm']):,.0f} ₸/м²"
                ),
                "delta": row["new_price_sqm"] - row["old_price_sqm"],
                "timestamp": row["triggered_at"],
            }
            for row in rows
        ]
