"""
Krisha.kz scraper using Playwright.
Extracts residential complex data for Astana.
"""
import asyncio
import re
import random
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

from playwright.async_api import async_playwright, Page, Browser
from loguru import logger


@dataclass
class PriceData:
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_avg: Optional[float] = None
    listings_count: int = 0


@dataclass
class ComplexData:
    name: str = ""
    developer: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    construction_stage: Optional[str] = None  # commissioned / under_construction / foundation / planned
    krisha_id: Optional[str] = None
    krisha_url: Optional[str] = None
    prices: PriceData = field(default_factory=PriceData)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


ASTANA_DISTRICTS = [
    "Есиль", "Алматы", "Байконур", "Сарыарка", "Нура"
]

STAGE_MAP = {
    "сдан": "commissioned",
    "сдача": "under_construction",
    "строительство": "under_construction",
    "котлован": "foundation",
    "проект": "planned",
    "введён": "commissioned",
    "эксплуатация": "commissioned",
}


def parse_price(text: str) -> Optional[float]:
    """Extract price number from text like '450 000 тг/м²'"""
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return float(digits) if digits else None


def detect_stage(text: str) -> str:
    text_lower = text.lower()
    for kw, stage in STAGE_MAP.items():
        if kw in text_lower:
            return stage
    return "under_construction"


def detect_district(address: str) -> Optional[str]:
    for district in ASTANA_DISTRICTS:
        if district.lower() in address.lower():
            return district
    return None


async def random_delay(min_sec: float = 2.0, max_sec: float = 5.0):
    """Anti-detection delay."""
    await asyncio.sleep(random.uniform(min_sec, max_sec))


class KrishaParser:
    BASE_URL = "https://krisha.kz"
    SEARCH_URL = "https://krisha.kz/prodazha/kvartiry/astana/?das[who]=1"  # новостройки

    def __init__(self, max_pages: int = 10, headless: bool = True):
        self.max_pages = max_pages
        self.headless = headless
        self._browser: Optional[Browser] = None

    async def __aenter__(self):
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
            ]
        )
        return self

    async def __aexit__(self, *args):
        if self._browser:
            await self._browser.close()
        await self._playwright.stop()

    async def _new_page(self) -> Page:
        context = await self._browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="ru-RU",
        )
        page = await context.new_page()
        # Hide webdriver flag
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        return page

    async def scrape_all(self) -> list[ComplexData]:
        """Main entry point: scrape all pages and return complex data."""
        complexes: dict[str, ComplexData] = {}

        page = await self._new_page()
        try:
            for page_num in range(1, self.max_pages + 1):
                url = f"{self.SEARCH_URL}&page={page_num}"
                logger.info(f"Scraping page {page_num}: {url}")

                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await random_delay(2, 4)

                    # Check for Cloudflare challenge
                    if "Checking your browser" in await page.title():
                        logger.warning("Cloudflare detected, waiting...")
                        await asyncio.sleep(10)
                        await page.wait_for_load_state("networkidle", timeout=20000)

                    listings = await page.query_selector_all(".a-list__item")
                    if not listings:
                        logger.info(f"No listings on page {page_num}, stopping.")
                        break

                    logger.info(f"Found {len(listings)} listings on page {page_num}")

                    for listing in listings:
                        try:
                            complex_data = await self._extract_listing(listing, page)
                            if complex_data and complex_data.name:
                                key = complex_data.krisha_id or complex_data.name
                                if key not in complexes:
                                    complexes[key] = complex_data
                                else:
                                    # Aggregate price data
                                    existing = complexes[key]
                                    self._merge_prices(existing, complex_data)
                        except Exception as e:
                            logger.warning(f"Failed to parse listing: {e}")

                    await random_delay(3, 6)

                except Exception as e:
                    logger.error(f"Failed to scrape page {page_num}: {e}")
                    if page_num == 1:
                        raise

        finally:
            await page.close()

        result = list(complexes.values())
        logger.info(f"Scraped {len(result)} unique complexes")
        return result

    async def _extract_listing(self, listing, page: Page) -> Optional[ComplexData]:
        """Extract data from a single listing card."""
        data = ComplexData()

        try:
            # Title / Complex name
            title_el = await listing.query_selector(".a-card__title")
            if title_el:
                full_title = await title_el.inner_text()
                # Try to find ЖК name in brackets or prefix
                zhk_match = re.search(r"ЖК\s+[«»\"']?([^«»\"',\n]+)", full_title, re.IGNORECASE)
                data.name = zhk_match.group(1).strip() if zhk_match else full_title.strip()[:100]

            # URL and krisha_id
            link_el = await listing.query_selector("a.a-card__title")
            if link_el:
                href = await link_el.get_attribute("href")
                if href:
                    data.krisha_url = f"{self.BASE_URL}{href}" if href.startswith("/") else href
                    id_match = re.search(r"/(\d+)\.html", href)
                    if id_match:
                        data.krisha_id = id_match.group(1)

            # Price
            price_el = await listing.query_selector(".a-card__price")
            if price_el:
                price_text = await price_el.inner_text()
                price_val = parse_price(price_text)
                if price_val:
                    data.prices.price_avg = price_val
                    data.prices.price_min = price_val
                    data.prices.price_max = price_val
                    data.prices.listings_count = 1

            # Address / district
            addr_el = await listing.query_selector(".a-card__description")
            if addr_el:
                addr_text = await addr_el.inner_text()
                data.address = addr_text.strip()[:500]
                data.district = detect_district(addr_text)

            # Developer / stage (usually in description)
            desc_el = await listing.query_selector(".a-card__stats")
            if desc_el:
                desc_text = await desc_el.inner_text()
                data.construction_stage = detect_stage(desc_text)

        except Exception as e:
            logger.debug(f"Partial extraction error: {e}")

        return data if data.name else None

    def _merge_prices(self, existing: ComplexData, new: ComplexData):
        """Merge price data from duplicate complex entries."""
        ep = existing.prices
        np = new.prices

        if np.price_min and (not ep.price_min or np.price_min < ep.price_min):
            ep.price_min = np.price_min
        if np.price_max and (not ep.price_max or np.price_max > ep.price_max):
            ep.price_max = np.price_max

        # Recalculate average
        if ep.listings_count > 0 and ep.price_avg and np.price_avg:
            total = ep.price_avg * ep.listings_count + np.price_avg * np.listings_count
            ep.listings_count += np.listings_count
            ep.price_avg = total / ep.listings_count
        elif np.price_avg:
            ep.price_avg = np.price_avg
            ep.listings_count += np.listings_count
