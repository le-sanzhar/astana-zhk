"""
LLM-as-judge using Groq (Llama 3.3 70B).

Each complex gets an AI-generated summary, then the judge scores it
against a rubric. Returns structured scores + reasoning.
"""

import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = Groq(api_key=os.environ["GROQ_API_KEY"])
MODEL = "llama-3.3-70b-versatile"

SUMMARY_SYSTEM = """Ты — аналитик рынка недвижимости Астаны.
Напиши краткое аналитическое резюме жилого комплекса (3-5 предложений).
Упомяни: ключевое преимущество для покупателя, риски, сравнение с рынком.
Пиши конкретно, избегай шаблонных фраз."""

JUDGE_SYSTEM = """You are an expert evaluator of AI-generated real estate analysis.
Score the summary on each criterion from 1 to 5. Return ONLY valid JSON, no extra text."""

JUDGE_RUBRIC = """
Criteria:
1. accuracy     — facts match the source data (price, district, stage, developer)
2. specificity  — uses concrete numbers/facts, not vague language
3. actionability — buyer can make a decision based on this summary
4. no_hallucination — no invented facts not present in source data
5. conciseness  — clear and to-the-point, no filler

Return JSON: {"accuracy": N, "specificity": N, "actionability": N,
              "no_hallucination": N, "conciseness": N, "reasoning": "..."}
"""


def generate_summary(complex_data: dict) -> str:
    """Generate AI summary for a complex using Groq."""
    prompt = f"""
Данные ЖК:
- Название: {complex_data['name']}
- Застройщик: {complex_data.get('developer', 'не указан')}
- Район: {complex_data.get('district', 'не указан')}
- Стадия: {complex_data.get('construction_stage', 'не указана')}
- Цена/м²: {(complex_data.get('price_avg') or 0):,.0f} ₸
- Срок сдачи: {complex_data.get('move_in', 'не указан')}
- Скоринг инвестора: {complex_data.get('investor_score', '?')}
- Скоринг семьи: {complex_data.get('family_score', '?')}
- Скоринг студента: {complex_data.get('student_score', '?')}
"""
    resp = _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=300,
    )
    return resp.choices[0].message.content.strip()


def judge_summary(complex_data: dict, summary: str) -> dict:
    """Judge the summary against rubric. Returns scores dict."""
    prompt = f"""
Source data:
{json.dumps(complex_data, ensure_ascii=False, indent=2)}

Generated summary:
{summary}

{JUDGE_RUBRIC}
"""
    resp = _client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        max_tokens=300,
    )
    raw = resp.choices[0].message.content.strip()
    # strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
