"""
Claude AI integration for generating analytics summaries.
Uses claude-3-haiku for cost efficiency.
"""
import os
from typing import Optional, List
from anthropic import AsyncAnthropic
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


def _build_prompt(complex_data: dict, scores: List[dict]) -> str:
    """Build structured prompt for Claude."""
    name = complex_data.get("name", "ЖК")
    developer = complex_data.get("developer", "неизвестный застройщик")
    district = complex_data.get("district", "")
    stage = complex_data.get("construction_stage", "")
    price_avg = complex_data.get("price_avg")
    listings = complex_data.get("listings_count")

    stage_labels = {
        "commissioned": "сдан",
        "under_construction": "в стадии строительства",
        "foundation": "на стадии котлована",
        "planned": "в стадии проекта",
    }

    score_lines = []
    for s in scores:
        emoji = {"green": "🟢", "yellow": "🟡", "red": "🔴"}.get(s.get("score", ""), "⚪")
        score_lines.append(
            f"- {s['profile'].upper()}: {emoji} {s.get('explanation', '')}"
        )

    price_str = f"{float(price_avg):,.0f} тг/м²" if price_avg else "нет данных"
    listings_str = f"{listings} объявлений" if listings else "нет данных"

    return f"""Ты аналитик рынка недвижимости Астаны. Напиши короткий аналитический вывод (2–3 предложения) о жилом комплексе на русском языке. Будь конкретным и полезным для инвесторов и покупателей.

ЖК: {name}
Застройщик: {developer}
Район: {district}
Стадия: {stage_labels.get(stage, stage)}
Средняя цена: {price_str}
Объявлений: {listings_str}

Скоринг по профилям:
{chr(10).join(score_lines)}

Напиши аналитический вывод одним абзацем — только текст, без заголовков и markdown."""


async def generate_ai_summary(complex_data: dict, scores: List[dict]) -> Optional[str]:
    """Generate a short AI analytics paragraph for a complex."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.warning("ANTHROPIC_API_KEY not set, returning placeholder")
        return "AI-аналитика недоступна. Установите ANTHROPIC_API_KEY в .env файле."

    try:
        prompt = _build_prompt(complex_data, scores)

        message = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        summary = message.content[0].text.strip()
        logger.info(f"Generated AI summary for {complex_data.get('name')}: {len(summary)} chars")
        return summary

    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return f"Ошибка генерации аналитики: {str(e)}"
