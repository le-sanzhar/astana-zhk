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

DB_PATH = Path(__file__).parent / "astana_zhk.db"

app = FastAPI(title="Korter Scraper API", version="1.0.0")
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


# ── Scoring (mirrors realEstate.ts calcScoreBreakdown) ────────────────────────

_DISTRICT_AVG: dict[str, float] = {
    "Есильский": 654_000,
    "Нура": 541_000,
    "Алматинский": 501_000,
    "Сарыарка": 423_000,
    "Байконурский": 350_000,
}


def _tone(ratio: float) -> str:
    if ratio >= 0.65:
        return "green"
    if ratio >= 0.40:
        return "yellow"
    return "red"


def _score(stage: str, district: str, price: float, growth: float, profile: str) -> str:
    d = district or ""

    if profile == "investor":
        g = 50 if growth >= 12 else 38 if growth >= 8 else 26 if growth >= 5 else 14 if growth >= 2 else 5
        s = 30 if stage == "foundation" else 22 if stage == "under_construction" else 14 if stage == "commissioned" else 8
        loc = 20 if d == "Есильский" else 16 if d in ("Нура", "Алматинский") else 10
        return _tone((g + s + loc) / 100)

    if profile == "family":
        s = 40 if stage == "commissioned" else 20 if stage == "under_construction" else 8 if stage == "foundation" else 4
        p = 10 if price <= 500_000 else 7 if price <= 700_000 else 3
        # school/park default to 4 pts each — no infrastructure data yet
        return _tone((s + 4 + 4 + p) / 100)

    if profile == "student":
        p = 40 if price <= 380_000 else 30 if price <= 450_000 else 18 if price <= 550_000 else 8 if price <= 680_000 else 2
        s = 25 if stage == "commissioned" else 14 if stage == "under_construction" else 5
        # transport defaults to 5 pts — no infrastructure data yet
        return _tone((p + 5 + s) / 100)

    if profile == "flipper":
        s = 35 if stage == "foundation" else 25 if stage == "under_construction" else 8
        m = 25 if growth >= 14 else 20 if growth >= 10 else 14 if growth >= 7 else 8 if growth >= 4 else 3
        da = _DISTRICT_AVG.get(d, 500_000)
        disc = (da - price) / da * 100 if price else 0
        dsc = 20 if disc >= 20 else 14 if disc >= 10 else 8 if disc >= 5 else 3
        if stage == "commissioned":
            liq = 18 if d == "Есильский" else 14 if d in ("Нура", "Алматинский") else 8
        elif stage == "under_construction":
            liq = 16 if d == "Есильский" else 13 if d in ("Нура", "Алматинский") else 12
        else:
            liq = 14 if d == "Есильский" else 8
        return _tone((s + m + dsc + liq) / 100)

    return "yellow"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _growth(snaps: list) -> float:
    if len(snaps) < 2:
        return 0.0
    first = snaps[0]["price_sqm"]
    last = snaps[-1]["price_sqm"]
    if not first:
        return 0.0
    return (last - first) / first * 100


def _monthly_payment(price_sqm: float, area: float = 60.0) -> int:
    """Otbasy Bank estimate: 5% annual, 20 yr term, 30% down."""
    loan = price_sqm * area * 0.70
    r = 0.05 / 12
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


def _build_item(row: dict | sqlite3.Row, snaps: list) -> dict:
    price = float(row["price_sqm"]) if row["price_sqm"] else None
    growth = _growth(snaps)
    stage = row["construction_stage"] or "commissioned"
    district = row["district"] or ""

    scored = {
        p: (_score(stage, district, price or 0, growth, p) if price else "yellow")
        for p in ["investor", "family", "student", "flipper"]
    }

    price_history = [
        {"price_avg": float(s["price_sqm"]), "recorded_at": s["recorded_at"]}
        for s in snaps
        if s["price_sqm"]
    ]
    img = row["image_url"] or _FALLBACK_IMG
    try:
        gallery: list[str] = json.loads(row["images_json"]) if row.get("images_json") else []
    except (TypeError, ValueError):
        gallery = []
    if not gallery:
        gallery = [img]

    return {
        "id": str(row["korter_id"]),
        "name": row["name"],
        "developer": row["developer"] or "",
        "address": row["address"] or "",
        "district": district,
        "price_avg": price or 0,
        "construction_stage": stage,
        "investor_score": scored["investor"],
        "family_score": scored["family"],
        "student_score": scored["student"],
        "flipper_score": scored["flipper"],
        "image": img,
        "gallery": gallery,
        "rating": 0.0,
        "review_count": 0,
        "price_monthly": _monthly_payment(price) if price else 0,
        "bedrooms": 2,
        "bathrooms": 1,
        "area_sqm": 60,
        "tagline": row["name"],
        "description": row["address"] or "",
        "move_in": _move_in(stage, row["end_year"], row["end_quarter"]),
        "agent": {"name": "", "role": row["developer"] or "", "avatar": ""},
        "price_snapshots": price_history,
        "scores": [
            {"profile": p, "score": scored[p], "score_value": 5.0, "explanation": ""}
            for p in ["investor", "family", "student", "flipper"]
        ],
        "ai_summary": "",
        "infrastructure": [],
        "krisha_url": row["korter_url"] or "",
        "coordinates": {
            "lat": float(row["lat"]) if row["lat"] else 0.0,
            "lng": float(row["lng"]) if row["lng"] else 0.0,
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "db": str(DB_PATH)}


@app.get("/api/v1/complexes")
def list_complexes(
    district: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    with _db() as conn:
        rows = conn.execute("""
            SELECT c.*,
                (SELECT price_sqm FROM price_snapshots
                 WHERE complex_id = c.id AND price_sqm IS NOT NULL
                 ORDER BY recorded_at DESC LIMIT 1) AS price_sqm
            FROM complexes c
        """).fetchall()

        items = []
        for row in rows:
            if not row["price_sqm"]:
                continue
            price = float(row["price_sqm"])
            if district and row["district"] != district:
                continue
            if stage and row["construction_stage"] != stage:
                continue
            if min_price and price < min_price:
                continue
            if max_price and price > max_price:
                continue

            snaps = conn.execute(
                "SELECT price_sqm, recorded_at FROM price_snapshots "
                "WHERE complex_id=? AND price_sqm IS NOT NULL ORDER BY recorded_at ASC",
                (row["id"],),
            ).fetchall()
            items.append(_build_item(row, snaps))

    return {"total": len(items), "items": items[offset: offset + limit]}


@app.get("/api/v1/complexes/{korter_id}")
def get_complex(korter_id: int):
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM complexes WHERE korter_id=?", (korter_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Комплекс не найден")

        row_dict = dict(row)
        latest = conn.execute(
            "SELECT price_sqm FROM price_snapshots "
            "WHERE complex_id=? AND price_sqm IS NOT NULL ORDER BY recorded_at DESC LIMIT 1",
            (row_dict["id"],),
        ).fetchone()
        row_dict["price_sqm"] = latest["price_sqm"] if latest else None

        snaps = conn.execute(
            "SELECT price_sqm, recorded_at FROM price_snapshots "
            "WHERE complex_id=? AND price_sqm IS NOT NULL ORDER BY recorded_at ASC",
            (row_dict["id"],),
        ).fetchall()
        return _build_item(row_dict, snaps)


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
