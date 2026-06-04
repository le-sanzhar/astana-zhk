"""
Reconnaissance script for korter.kz.

Discovers the API structure used by korter.kz for new-build listings in Astana.
Tries three strategies in order:
  1. __NEXT_DATA__ embedded JSON in the HTML page
  2. Intercept XHR/fetch calls via Playwright network listener
  3. Probe common REST API patterns directly with httpx

Run:
    cd C:\\Users\\dash\\.gemini\\antigravity\\scratch\\AstanaZhK
    python -m scraper.recon_korter
"""

import asyncio
import json
import re
import httpx
from pathlib import Path
from loguru import logger
from playwright.async_api import async_playwright

# ── Config ────────────────────────────────────────────────────────────────────

ASTANA_URLS = [
    "https://korter.kz/ru/astana/novostrojki",
    "https://korter.kz/ru/astana",
    "https://korter.kz/astana",
    "https://korter.kz/astana/novostrojki",
]

# REST API candidates to probe directly
API_CANDIDATES = [
    "https://korter.kz/api/v1/complexes?city=astana&page=1",
    "https://korter.kz/api/v2/complexes?city=astana&page=1",
    "https://korter.kz/api/complexes?city=1&page=1",
    "https://korter.kz/api/v1/projects?city=astana",
    "https://korter.kz/api/v1/newbuildings?city=astana",
    "https://korter.kz/api/search?type=complex&city=astana",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Referer": "https://korter.kz/",
}

OUT_DIR = Path(__file__).parent / "_recon_output"
OUT_DIR.mkdir(exist_ok=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def save(name: str, data: dict | list | str):
    path = OUT_DIR / f"{name}.json"
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8")
    else:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.success(f"Saved → {path}")


def print_structure(obj, depth=0, max_depth=3, label="root"):
    """Print a condensed schema of a JSON object."""
    indent = "  " * depth
    if depth > max_depth:
        print(f"{indent}...")
        return
    if isinstance(obj, dict):
        print(f"{indent}{label}: {{  ({len(obj)} keys)")
        for k, v in list(obj.items())[:12]:
            print_structure(v, depth + 1, max_depth, label=k)
        if len(obj) > 12:
            print(f"{indent}  ... +{len(obj)-12} more keys")
        print(f"{indent}}}")
    elif isinstance(obj, list):
        print(f"{indent}{label}: [  ({len(obj)} items)")
        if obj:
            print_structure(obj[0], depth + 1, max_depth, label="[0]")
        print(f"{indent}]")
    else:
        val_preview = str(obj)[:80]
        print(f"{indent}{label}: {type(obj).__name__} = {val_preview!r}")


# ── Strategy 1: __NEXT_DATA__ in HTML ─────────────────────────────────────────

async def try_next_data():
    logger.info("Strategy 1: Looking for __NEXT_DATA__ in page HTML...")

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
        for url in ASTANA_URLS:
            try:
                resp = await client.get(url)
                logger.info(f"  GET {url} → {resp.status_code}")

                if resp.status_code != 200:
                    continue

                html = resp.text
                match = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
                if match:
                    raw = match.group(1).strip()
                    data = json.loads(raw)
                    logger.success(f"  Found __NEXT_DATA__ on {url}")
                    save("next_data_raw", data)

                    print("\n── __NEXT_DATA__ structure ──────────────────")
                    print_structure(data)

                    # Dig into pageProps to find the complex list
                    props = data.get("props", {}).get("pageProps", {})
                    if props:
                        print("\n── pageProps structure ──────────────────────")
                        print_structure(props)
                        save("next_data_page_props", props)
                    return True

                # Also check for inline JSON in script tags
                json_blocks = re.findall(r'<script[^>]*>\s*window\.__(?:INITIAL|STATE|DATA)__\s*=\s*(\{.*?\})\s*;?\s*</script>', html, re.S)
                if json_blocks:
                    logger.success(f"  Found inline window state on {url}")
                    data = json.loads(json_blocks[0])
                    save("window_state", data)
                    print_structure(data)
                    return True

            except Exception as e:
                logger.warning(f"  {url} failed: {e}")

    logger.info("  Strategy 1: no embedded JSON found")
    return False


# ── Strategy 2: Playwright XHR intercept ─────────────────────────────────────

async def try_xhr_intercept():
    logger.info("Strategy 2: Intercepting XHR/fetch with Playwright...")

    captured: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=HEADERS["User-Agent"],
            locale="ru-RU",
        )
        page = await context.new_page()

        async def on_response(response):
            url = response.url
            # Only capture JSON responses that look like data APIs
            if any(kw in url for kw in ["/api/", "graphql", "json", "search", "complex", "project", "newbuild"]):
                try:
                    ct = response.headers.get("content-type", "")
                    if "json" in ct:
                        body = await response.json()
                        captured.append({"url": url, "status": response.status, "body": body})
                        logger.info(f"  Captured JSON from: {url}")
                except Exception:
                    pass

        page.on("response", on_response)

        target_url = ASTANA_URLS[0]
        logger.info(f"  Loading {target_url}")
        try:
            await page.goto(target_url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)  # Let lazy-loaded requests fire

            # Scroll to trigger pagination/lazy load
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)
        except Exception as e:
            logger.warning(f"  Page load issue: {e}")

        await browser.close()

    if captured:
        logger.success(f"  Captured {len(captured)} JSON responses")
        save("xhr_captured", captured)

        print(f"\n── Captured {len(captured)} XHR responses ─────────")
        for item in captured:
            print(f"\n  URL: {item['url']}")
            print(f"  Status: {item['status']}")
            print_structure(item["body"], max_depth=2)

        return True

    logger.info("  Strategy 2: no JSON XHR captured")
    return False


# ── Strategy 3: Probe REST API endpoints directly ─────────────────────────────

async def try_rest_probe():
    logger.info("Strategy 3: Probing REST API candidates...")

    found: list[dict] = []

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=15) as client:
        for url in API_CANDIDATES:
            try:
                resp = await client.get(url)
                ct = resp.headers.get("content-type", "")
                logger.info(f"  GET {url} → {resp.status_code} [{ct[:40]}]")

                if resp.status_code == 200 and "json" in ct:
                    data = resp.json()
                    found.append({"url": url, "data": data})
                    logger.success(f"  ✓ JSON API found at {url}")
                    save(f"api_{url.split('/')[-1].replace('?','_')}", data)
                    print(f"\n── {url} ──────────")
                    print_structure(data)

            except Exception as e:
                logger.debug(f"  {url}: {e}")

    if found:
        return True

    logger.info("  Strategy 3: no open REST endpoints found")
    return False


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    print("=" * 60)
    print("korter.kz API Reconnaissance")
    print(f"Output dir: {OUT_DIR}")
    print("=" * 60)

    found = await try_next_data()
    if not found:
        found = await try_xhr_intercept()
    if not found:
        await try_rest_probe()

    if not found:
        logger.warning(
            "All strategies failed. korter.kz may require cookies/auth "
            "or use a non-standard data delivery method. "
            "Try opening the site manually in DevTools → Network → XHR "
            "and note the request URLs."
        )
    else:
        print("\n✓ Recon complete — check _recon_output/ for raw JSON files")


if __name__ == "__main__":
    asyncio.run(main())
