"""
SQLite storage for korter.kz price monitoring.

Tables
------
complexes       — master list of buildings (upserted each run)
price_snapshots — daily price per m² history
price_alerts    — generated when delta >= ALERT_THRESHOLD_PCT
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, date
from pathlib import Path
from typing import Optional
from loguru import logger

from .parser_korter import KorterBuilding

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "astana_zhk.db"
ALERT_THRESHOLD_PCT = 3.0     # % change vs previous snapshot that triggers alert


# ── Connection ────────────────────────────────────────────────────────────────

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Schema ────────────────────────────────────────────────────────────────────

def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS complexes (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                korter_id           INTEGER UNIQUE NOT NULL,
                name                TEXT NOT NULL,
                developer           TEXT,
                address             TEXT,
                district            TEXT,
                construction_stage  TEXT,
                lat                 REAL,
                lng                 REAL,
                korter_url          TEXT,
                image_url           TEXT,
                images_json         TEXT,
                end_year            INTEGER,
                end_quarter         INTEGER,
                created_at          TEXT DEFAULT (datetime('now')),
                updated_at          TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS price_snapshots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                complex_id  INTEGER NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
                price_sqm   REAL,
                recorded_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS price_alerts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                complex_id      INTEGER NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
                complex_name    TEXT NOT NULL,
                old_price_sqm   REAL,
                new_price_sqm   REAL,
                delta_pct       REAL,
                triggered_at    TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_snap_complex ON price_snapshots(complex_id);
            CREATE INDEX IF NOT EXISTS idx_snap_recorded ON price_snapshots(recorded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON price_alerts(triggered_at DESC);
        """)
        # Migration: add images_json if it doesn't exist yet
        cols = {row[1] for row in conn.execute("PRAGMA table_info(complexes)").fetchall()}
        if "images_json" not in cols:
            conn.execute("ALTER TABLE complexes ADD COLUMN images_json TEXT")
            logger.info("Migration: added images_json column")
    logger.info(f"DB ready: {DB_PATH}")


# ── Upsert complexes ──────────────────────────────────────────────────────────

def upsert_complexes(buildings: list[KorterBuilding]) -> dict[int, int]:
    """
    Upsert buildings into complexes table.
    Returns {korter_id -> db_row_id}.
    """
    id_map: dict[int, int] = {}

    with get_conn() as conn:
        for b in buildings:
            images_json = json.dumps(b.image_urls, ensure_ascii=False) if b.image_urls else None
            conn.execute("""
                INSERT INTO complexes
                    (korter_id, name, developer, address, district,
                     construction_stage, lat, lng, korter_url, image_url,
                     images_json, end_year, end_quarter, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
                ON CONFLICT(korter_id) DO UPDATE SET
                    name               = excluded.name,
                    developer          = COALESCE(excluded.developer, developer),
                    address            = COALESCE(excluded.address, address),
                    district           = COALESCE(excluded.district, district),
                    construction_stage = excluded.construction_stage,
                    lat                = COALESCE(excluded.lat, lat),
                    lng                = COALESCE(excluded.lng, lng),
                    korter_url         = excluded.korter_url,
                    image_url          = COALESCE(excluded.image_url, image_url),
                    images_json        = COALESCE(excluded.images_json, images_json),
                    end_year           = COALESCE(excluded.end_year, end_year),
                    end_quarter        = COALESCE(excluded.end_quarter, end_quarter),
                    updated_at         = datetime('now')
            """, (
                b.korter_id, b.name, b.developer, b.address, b.district,
                b.construction_status, b.lat, b.lng, b.korter_url, b.image_url,
                images_json, b.end_year, b.end_quarter,
            ))

        rows = conn.execute(
            "SELECT id, korter_id FROM complexes WHERE korter_id IN ({})".format(
                ",".join("?" * len(buildings))
            ),
            [b.korter_id for b in buildings],
        ).fetchall()
        id_map = {row["korter_id"]: row["id"] for row in rows}

    logger.info(f"Upserted {len(id_map)} complexes")
    return id_map


# ── Insert snapshots + detect alerts ─────────────────────────────────────────

def insert_snapshots_and_alert(
    buildings: list[KorterBuilding],
    id_map: dict[int, int],
) -> list[dict]:
    """
    Insert today's price snapshot for each building that has a price.
    Skip if we already have a snapshot for today (idempotent).
    Detect price changes > ALERT_THRESHOLD_PCT vs last snapshot.
    Returns list of alert dicts (for logging / push notifications).
    """
    today = date.today().isoformat()
    alerts = []

    with get_conn() as conn:
        for b in buildings:
            if b.min_price_sqm is None:
                continue
            db_id = id_map.get(b.korter_id)
            if db_id is None:
                continue

            # Skip if we already recorded today
            existing = conn.execute(
                "SELECT 1 FROM price_snapshots WHERE complex_id=? AND DATE(recorded_at)=?",
                (db_id, today),
            ).fetchone()
            if existing:
                continue

            # Get previous snapshot for delta calculation
            prev = conn.execute(
                """SELECT price_sqm FROM price_snapshots
                   WHERE complex_id=? AND price_sqm IS NOT NULL
                   ORDER BY recorded_at DESC LIMIT 1""",
                (db_id,),
            ).fetchone()

            conn.execute(
                "INSERT INTO price_snapshots (complex_id, price_sqm) VALUES (?, ?)",
                (db_id, b.min_price_sqm),
            )

            if prev and prev["price_sqm"]:
                old = prev["price_sqm"]
                delta_pct = (b.min_price_sqm - old) / old * 100
                if abs(delta_pct) >= ALERT_THRESHOLD_PCT:
                    conn.execute(
                        """INSERT INTO price_alerts
                           (complex_id, complex_name, old_price_sqm, new_price_sqm, delta_pct)
                           VALUES (?,?,?,?,?)""",
                        (db_id, b.name, old, b.min_price_sqm, delta_pct),
                    )
                    alerts.append({
                        "complex_id":   b.korter_id,
                        "complex_name": b.name,
                        "old_price":    old,
                        "new_price":    b.min_price_sqm,
                        "delta_pct":    delta_pct,
                    })
                    logger.info(
                        f"ALERT {b.name}: {old:,.0f} → {b.min_price_sqm:,.0f} "
                        f"({delta_pct:+.1f}%)"
                    )

    logger.info(
        f"Snapshots: inserted for {sum(1 for b in buildings if b.min_price_sqm)} buildings, "
        f"{len(alerts)} alerts triggered"
    )
    return alerts


# ── Read helpers (for API / export) ──────────────────────────────────────────

def get_complexes_needing_gallery(max_images: int = 1) -> list[dict]:
    """Return buildings where images_json has ≤ max_images (need detail enrichment)."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT korter_id, korter_url, images_json FROM complexes"
        ).fetchall()
        result = []
        for row in rows:
            ij = row["images_json"]
            count = len(json.loads(ij)) if ij else 0
            if count <= max_images:
                result.append({"korter_id": row["korter_id"], "korter_url": row["korter_url"]})
        return result


def update_images_json(korter_id: int, image_urls: list[str]) -> None:
    """Overwrite images_json and image_url for a single building."""
    with get_conn() as conn:
        conn.execute(
            """UPDATE complexes
               SET images_json = ?, image_url = ?, updated_at = datetime('now')
               WHERE korter_id = ?""",
            (json.dumps(image_urls, ensure_ascii=False), image_urls[0] if image_urls else None, korter_id),
        )


def get_all_complexes() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM complexes ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]


def get_price_history(korter_id: int, limit: int = 30) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT ps.price_sqm, ps.recorded_at
               FROM price_snapshots ps
               JOIN complexes c ON c.id = ps.complex_id
               WHERE c.korter_id = ? AND ps.price_sqm IS NOT NULL
               ORDER BY ps.recorded_at DESC LIMIT ?""",
            (korter_id, limit),
        ).fetchall()
        return [dict(r) for r in reversed(rows)]


def get_recent_alerts(days: int = 7) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT pa.*, c.korter_id, c.korter_url, c.district
               FROM price_alerts pa
               JOIN complexes c ON c.id = pa.complex_id
               WHERE pa.triggered_at >= datetime('now', ?)
               ORDER BY pa.triggered_at DESC""",
            (f"-{days} days",),
        ).fetchall()
        return [dict(r) for r in rows]


def get_stats() -> dict:
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM complexes").fetchone()[0]
        with_price = conn.execute(
            "SELECT COUNT(DISTINCT complex_id) FROM price_snapshots"
        ).fetchone()[0]
        snapshots = conn.execute(
            "SELECT COUNT(*) FROM price_snapshots"
        ).fetchone()[0]
        alerts = conn.execute(
            "SELECT COUNT(*) FROM price_alerts"
        ).fetchone()[0]
        last_run = conn.execute(
            "SELECT MAX(recorded_at) FROM price_snapshots"
        ).fetchone()[0]
        return {
            "total_complexes": total,
            "complexes_with_price": with_price,
            "total_snapshots": snapshots,
            "total_alerts": alerts,
            "last_run": last_run,
        }
