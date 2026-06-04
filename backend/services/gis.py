"""
2GIS Places API integration.
Fetches nearby infrastructure for a given location.
"""
import os
from typing import Optional
import httpx
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

DGIS_API_KEY = os.getenv("DGIS_API_KEY", "")
DGIS_BASE = "https://catalog.api.2gis.com/3.0"

CATEGORY_MAP = {
    "school": "164",         # Школы
    "kindergarten": "167",   # Детские сады
    "grocery": "161",        # Продуктовые магазины
    "hospital": "163",       # Больницы
    "bus_stop": "2063",      # Остановки
    "metro": "2065",         # Метро
    "park": "2035",          # Парки
}

SEARCH_RADIUS = 1000  # meters


async def fetch_nearby(
    lat: float,
    lon: float,
    category_type: str,
    radius: int = SEARCH_RADIUS,
) -> list[dict]:
    """Fetch places of a given category near lat/lon."""
    if not DGIS_API_KEY:
        logger.warning("DGIS_API_KEY not set, skipping infrastructure fetch")
        return []

    rubric_id = CATEGORY_MAP.get(category_type)
    if not rubric_id:
        return []

    params = {
        "key": DGIS_API_KEY,
        "q": category_type,
        "point": f"{lon},{lat}",
        "radius": radius,
        "rubric_id": rubric_id,
        "fields": "items.point,items.name,items.distance",
        "page_size": 10,
        "locale": "ru_KZ",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{DGIS_BASE}/items", params=params)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("result", {}).get("items", [])
        return [
            {
                "type": category_type,
                "name": item.get("name", ""),
                "distance_meters": item.get("distance", 9999),
                "latitude": item.get("point", {}).get("lat"),
                "longitude": item.get("point", {}).get("lon"),
            }
            for item in items
        ]
    except Exception as e:
        logger.error(f"2GIS API error for {category_type}: {e}")
        return []


async def fetch_all_infrastructure(lat: float, lon: float) -> list[dict]:
    """Fetch all infrastructure types for a complex location."""
    import asyncio
    tasks = [
        fetch_nearby(lat, lon, cat)
        for cat in CATEGORY_MAP.keys()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_items = []
    for result in results:
        if isinstance(result, list):
            all_items.extend(result)

    logger.info(f"Fetched {len(all_items)} infrastructure items near ({lat}, {lon})")
    return all_items
