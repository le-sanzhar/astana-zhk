"""
Database operations for the scraper.
Upserts complex data and inserts new price snapshots.
"""
import os
from datetime import datetime
from typing import List
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from loguru import logger

from .parser import ComplexData

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/astana_zhk")


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def upsert_complexes(complexes: List[ComplexData]) -> dict[str, str]:
    """
    Upsert complex records. Returns mapping of krisha_id -> db UUID.
    """
    id_map: dict[str, str] = {}

    with get_connection() as conn:
        with conn.cursor() as cur:
            for c in complexes:
                try:
                    cur.execute("""
                        INSERT INTO complexes (name, developer, address, district,
                                              construction_stage, krisha_id, krisha_url,
                                              latitude, longitude)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (krisha_id) DO UPDATE SET
                            name              = EXCLUDED.name,
                            developer         = COALESCE(EXCLUDED.developer, complexes.developer),
                            address           = COALESCE(EXCLUDED.address, complexes.address),
                            district          = COALESCE(EXCLUDED.district, complexes.district),
                            construction_stage= COALESCE(EXCLUDED.construction_stage, complexes.construction_stage),
                            krisha_url        = COALESCE(EXCLUDED.krisha_url, complexes.krisha_url),
                            latitude          = COALESCE(EXCLUDED.latitude, complexes.latitude),
                            longitude         = COALESCE(EXCLUDED.longitude, complexes.longitude),
                            updated_at        = NOW()
                        RETURNING id, krisha_id
                    """, (
                        c.name, c.developer, c.address, c.district,
                        c.construction_stage, c.krisha_id, c.krisha_url,
                        c.latitude, c.longitude,
                    ))
                    row = cur.fetchone()
                    if row:
                        db_id, krisha_id = row
                        id_map[krisha_id or c.name] = str(db_id)
                except Exception as e:
                    logger.error(f"Failed to upsert complex {c.name}: {e}")
                    conn.rollback()
                    continue

        conn.commit()

    logger.info(f"Upserted {len(id_map)} complexes to DB")
    return id_map


def insert_price_snapshots(complexes: List[ComplexData], id_map: dict[str, str]):
    """Insert price snapshots for all complexes."""
    rows = []
    now = datetime.utcnow()

    for c in complexes:
        key = c.krisha_id or c.name
        db_id = id_map.get(key)
        if not db_id:
            continue

        p = c.prices
        if p.price_avg or p.price_min:
            rows.append((
                db_id,
                p.price_min,
                p.price_max,
                p.price_avg,
                None,  # area_min
                None,  # area_max
                p.listings_count,
                now,
            ))

    if not rows:
        return

    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO price_snapshots
                    (complex_id, price_min, price_max, price_avg,
                     total_area_min, total_area_max, listings_count, recorded_at)
                VALUES %s
            """, rows)
        conn.commit()

    logger.info(f"Inserted {len(rows)} price snapshots")
