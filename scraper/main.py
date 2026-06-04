"""
Entry point for the korter.kz price monitor.

Usage
-----
    # One-shot full scrape
    python -m scraper.main --now

    # Run once immediately, then schedule daily at 06:00 Almaty
    python -m scraper.main

    # Print DB stats
    python -m scraper.main --stats

    # Print recent price alerts (last 7 days)
    python -m scraper.main --alerts
"""

import asyncio
import json
import sys
from loguru import logger

from .parser_korter import KorterParser
from .db_sqlite import (
    init_db, upsert_complexes, insert_snapshots_and_alert,
    get_stats, get_recent_alerts,
    get_complexes_needing_gallery, update_images_json,
)
from .scheduler import start_scheduler


# ── Core scrape job ───────────────────────────────────────────────────────────

async def scrape_and_save(max_pages: int = 60) -> list[dict]:
    """Full scrape → upsert → snapshot → alerts. Returns alert list."""
    logger.info(f"=== korter.kz scrape started (max {max_pages} pages) ===")

    async with KorterParser(max_pages=max_pages) as parser:
        buildings = await parser.scrape_all()

    if not buildings:
        logger.warning("No buildings scraped — aborting save")
        return []

    id_map = upsert_complexes(buildings)
    alerts = insert_snapshots_and_alert(buildings, id_map)

    stats = get_stats()
    logger.success(
        f"=== Done: {len(buildings)} buildings scraped, "
        f"{stats['total_snapshots']} total snapshots, "
        f"{len(alerts)} new alerts ==="
    )

    if alerts:
        logger.info("Price alerts:")
        for a in alerts:
            arrow = "▲" if a["delta_pct"] > 0 else "▼"
            logger.info(
                f"  {arrow} {a['complex_name']}: "
                f"{a['old_price']:,.0f} → {a['new_price']:,.0f} "
                f"({a['delta_pct']:+.1f}%)"
            )

    return alerts


def run_scrape(max_pages: int = 60):
    """Sync wrapper for use by APScheduler."""
    asyncio.run(scrape_and_save(max_pages=max_pages))


async def enrich_galleries(delay: float = 1.2) -> None:
    """
    Visit each building's detail page and populate images_json with the full gallery.
    Only processes buildings that currently have ≤ 1 image.
    """
    targets = get_complexes_needing_gallery(max_images=1)
    logger.info(f"Gallery enrichment: {len(targets)} buildings to enrich")

    enriched = 0
    async with KorterParser() as parser:
        for i, t in enumerate(targets, 1):
            urls = await parser.fetch_building_gallery(t["korter_url"])
            if urls:
                update_images_json(t["korter_id"], urls)
                enriched += 1
                if len(urls) > 1:
                    logger.info(f"[{i}/{len(targets)}] {t['korter_url'].split('/')[-1]}: {len(urls)} фото")
            else:
                logger.debug(f"[{i}/{len(targets)}] no gallery: {t['korter_url'].split('/')[-1]}")
            await asyncio.sleep(delay)

    logger.success(f"Gallery enrichment done: {enriched}/{len(targets)} updated")


# ── CLI ───────────────────────────────────────────────────────────────────────

def print_stats():
    stats = get_stats()
    print("\nDB Stats:")
    for k, v in stats.items():
        print(f"  {k}: {v}")


def print_alerts():
    alerts = get_recent_alerts(days=7)
    if not alerts:
        print("No alerts in the last 7 days.")
        return
    print(f"\n{len(alerts)} price alerts (last 7 days):\n")
    for a in alerts:
        arrow = "+" if a["delta_pct"] > 0 else ""
        print(
            f"  {a['complex_name']} ({a.get('district','?')})\n"
            f"    {a['old_price_sqm']:,.0f} -> {a['new_price_sqm']:,.0f} "
            f"T/m2  ({arrow}{a['delta_pct']:.1f}%)  "
            f"at {a['triggered_at']}\n"
        )


if __name__ == "__main__":
    init_db()

    if "--stats" in sys.argv:
        print_stats()

    elif "--alerts" in sys.argv:
        print_alerts()

    elif "--gallery" in sys.argv:
        asyncio.run(enrich_galleries())

    elif "--now" in sys.argv:
        asyncio.run(scrape_and_save())

    else:
        # Run immediately, then schedule
        asyncio.run(scrape_and_save())
        scheduler = start_scheduler()
        logger.info("Scheduler running. Press Ctrl+C to stop.")
        try:
            asyncio.get_event_loop().run_forever()
        except KeyboardInterrupt:
            scheduler.shutdown()
            logger.info("Stopped.")
