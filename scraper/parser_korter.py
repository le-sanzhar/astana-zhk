"""
korter.kz scraper — primary market new builds in Astana.

Strategy: the site is fully SSR; all listing data is embedded in
window.INITIAL_STATE inside the page HTML.

Catalog URL:  https://korter.kz/новостройки-астаны?page={n}
Page size: 20 buildings.  Total: ~1 000+ listings.

Fields extracted per building:
  buildingId, name, address, district, developer,
  construction_status, min_price_sqm, lat, lng,
  korter_url, end_year, end_quarter
"""

import asyncio
import json
import re
import random
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

import httpx
from loguru import logger


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class KorterBuilding:
    korter_id:          int
    korter_url:         str
    name:               str
    address:            str
    district:           Optional[str]       # subLocalityNominative
    developer:          Optional[str]
    construction_status: str               # 'ready' | 'construction' | 'stopped'
    min_price_sqm:      Optional[float]    # ₸/m²
    lat:                Optional[float]
    lng:                Optional[float]
    end_year:           Optional[int]
    end_quarter:        Optional[int]
    image_url:          Optional[str]
    image_urls:         list[str] = field(default_factory=list)  # up to 5 gallery images


CONSTRUCTION_STATUS_MAP = {
    'ready':        'commissioned',
    'construction': 'under_construction',
    'stopped':      'under_construction',
    'planned':      'planned',
}


# ── HTTP helpers ──────────────────────────────────────────────────────────────

CATALOG_URL = "https://korter.kz/новостройки-астаны"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Referer": "https://korter.kz/",
}


def _extract_state(html: str) -> Optional[dict]:
    """Extract window.INITIAL_STATE from SSR HTML."""
    for s in re.findall(r'<script[^>]*>(.*?)</script>', html, re.S):
        if 'INITIAL_STATE' not in s:
            continue
        m = re.search(r'window\.INITIAL_STATE\s*=\s*(\{)', s)
        if m:
            try:
                data, _ = json.JSONDecoder().raw_decode(s, m.start(1))
                return data
            except json.JSONDecodeError:
                pass
    return None


def _parse_building(raw: dict) -> Optional[KorterBuilding]:
    """Parse a single building dict from buildingListingStore.buildings."""
    bid = raw.get('buildingId')
    if not bid:
        return None

    name = (raw.get('name') or '').strip()
    if not name:
        return None

    # Developer name
    devs = raw.get('developers') or []
    developer = devs[0].get('name') if devs and isinstance(devs[0], dict) else None

    # Images — extract up to 5, prefer x2 resolution
    images = raw.get('images') or []
    image_url: Optional[str] = None
    image_urls: list[str] = []
    for img in images[:5]:
        if not isinstance(img, dict):
            continue
        src = img.get('mediaSrc', {}).get('default', {})
        url = src.get('x2') or src.get('x1')
        if url:
            image_urls.append(url)
    if image_urls:
        image_url = image_urls[0]

    # Location
    loc = raw.get('location') or {}
    lat = loc.get('lat')
    lng = loc.get('lng')

    # Price — prefer minPriceSqm, fall back to minPriceSqmByLayouts
    price = raw.get('minPriceSqm') or raw.get('minPriceSqmByLayouts')

    return KorterBuilding(
        korter_id=bid,
        korter_url=f"https://korter.kz{raw.get('url', '')}",
        name=name,
        address=raw.get('address') or '',
        district=raw.get('subLocalityNominative'),
        developer=developer,
        construction_status=CONSTRUCTION_STATUS_MAP.get(
            raw.get('constructionStatus', ''), 'under_construction'
        ),
        min_price_sqm=float(price) if price else None,
        lat=float(lat) if lat else None,
        lng=float(lng) if lng else None,
        end_year=raw.get('endYear'),
        end_quarter=raw.get('endQuarter'),
        image_url=image_url,
        image_urls=image_urls,
    )


# ── Main scraper class ────────────────────────────────────────────────────────

class KorterParser:
    def __init__(
        self,
        max_pages: int = 60,          # 60 × 20 = 1 200 buildings
        only_with_price: bool = False, # skip buildings without price
        delay_range: tuple = (1.5, 3.5),
    ):
        self.max_pages = max_pages
        self.only_with_price = only_with_price
        self.delay_range = delay_range
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            headers=HEADERS,
            follow_redirects=True,
            timeout=25,
        )
        return self

    async def __aexit__(self, *_):
        if self._client:
            await self._client.aclose()

    async def _fetch_page(self, page: int) -> list[KorterBuilding]:
        url = f"{CATALOG_URL}?page={page}"
        try:
            resp = await self._client.get(url)
            if resp.status_code != 200:
                logger.warning(f"Page {page}: HTTP {resp.status_code}")
                return []

            state = _extract_state(resp.text)
            if not state:
                logger.warning(f"Page {page}: INITIAL_STATE not found")
                return []

            raw_buildings = state.get('buildingListingStore', {}).get('buildings', [])
            buildings = []
            for raw in raw_buildings:
                b = _parse_building(raw)
                if b is None:
                    continue
                if self.only_with_price and b.min_price_sqm is None:
                    continue
                buildings.append(b)

            logger.info(f"Page {page}: {len(raw_buildings)} raw → {len(buildings)} parsed")
            return buildings

        except Exception as e:
            logger.error(f"Page {page} failed: {e}")
            return []

    async def fetch_building_gallery(self, korter_url: str) -> list[str]:
        """Fetch a building detail page and return all photo URLs (up to 10)."""
        try:
            resp = await self._client.get(korter_url)
            if resp.status_code != 200:
                return []
            state = _extract_state(resp.text)
            if not state:
                return []

            # Detail pages use buildingLandingStore.gallery.images
            images = (
                state.get('buildingLandingStore', {})
                     .get('gallery', {})
                     .get('images', [])
            )
            urls: list[str] = []
            for img in images[:10]:
                if not isinstance(img, dict):
                    continue
                # Only real photos, skip render/floor-plan types
                if img.get('imageType') not in ('photo', 'constructionState'):
                    continue
                src = img.get('mediaSrc', {}).get('default', {})
                url = src.get('x2') or src.get('x1') or img.get('src')
                if url and url not in urls:
                    urls.append(url)
            return urls

        except Exception as e:
            logger.warning(f"Gallery fetch failed for {korter_url}: {e}")
            return []

    async def scrape_all(self) -> list[KorterBuilding]:
        """Scrape all pages. Returns deduplicated list ordered by korter_id."""
        seen: dict[int, KorterBuilding] = {}

        for page in range(1, self.max_pages + 1):
            buildings = await self._fetch_page(page)

            if not buildings:
                logger.info(f"No results on page {page}, stopping.")
                break

            for b in buildings:
                seen[b.korter_id] = b   # last write wins (same data anyway)

            await asyncio.sleep(random.uniform(*self.delay_range))

        result = sorted(seen.values(), key=lambda b: b.korter_id)
        logger.success(f"Scraped {len(result)} unique buildings total")
        return result


# ── Quick smoke-test ──────────────────────────────────────────────────────────

async def _smoke_test():
    """Scrape first 2 pages and print results."""
    import sys, io
    out = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    async with KorterParser(max_pages=2) as parser:
        buildings = await parser.scrape_all()

    sep = '-' * 70
    out.write(f"\n{sep}\n")
    out.write(f"{'ID':>6}  {'Name':<36} {'District':<15} {'Price/m2':>10}  Status\n")
    out.write(f"{sep}\n")
    for b in buildings:
        price = f"{int(b.min_price_sqm):,}" if b.min_price_sqm else 'N/A'
        out.write(f"{b.korter_id:>6}  {b.name[:35]:<36} {(b.district or 'N/A')[:14]:<15} {price:>10}  {b.construction_status}\n")
    out.write(f"{sep}\n")
    out.write(f"Total: {len(buildings)}  |  with price: {sum(1 for b in buildings if b.min_price_sqm)}\n")
    out.flush()


if __name__ == '__main__':
    asyncio.run(_smoke_test())
