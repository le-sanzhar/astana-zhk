"""
Eval runner for AstanaZhK AI summaries.

Usage:
    python -m evals.run_evals              # evaluate 20 complexes
    python -m evals.run_evals --n 50       # evaluate 50
    python -m evals.run_evals --out report.json

Flow:
    1. Sample N complexes from SQLite DB
    2. Generate AI summary via Groq (Llama 3.3 70B)
    3. Judge summary via Groq (LLM-as-judge)
    4. Aggregate scores → print + save report
"""

import argparse
import io
import json
import sqlite3
import sys
import time
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from .judge import generate_summary, judge_summary

DB_PATH = Path(__file__).parent.parent / "scraper" / "astana_zhk.db"
CRITERIA = ["accuracy", "specificity", "actionability", "no_hallucination", "conciseness"]
PASS_THRESHOLD = 3.5  # avg score to count as PASS


def load_complexes(n: int) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT c.*,
            (SELECT price_sqm FROM price_snapshots
             WHERE complex_id=c.id AND price_sqm IS NOT NULL
             ORDER BY recorded_at DESC LIMIT 1) AS price_avg
        FROM complexes c
        WHERE c.district IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
    """, (n,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def score_to_label(avg: float) -> str:
    if avg >= 4.5: return "excellent"
    if avg >= 3.5: return "pass"
    if avg >= 2.5: return "borderline"
    return "fail"


def run(n: int, out: str | None):
    complexes = load_complexes(n)
    print(f"\n{'='*60}")
    print(f"AstanaZhK AI Summary Eval — {n} complexes")
    print(f"Model: Groq / llama-3.3-70b-versatile | {datetime.now():%Y-%m-%d %H:%M}")
    print(f"{'='*60}\n")

    results = []
    totals = {c: 0.0 for c in CRITERIA}
    passed = 0

    for i, cx in enumerate(complexes, 1):
        name = cx["name"][:40]
        print(f"[{i:02d}/{n}] {name:<40}", end=" ", flush=True)

        try:
            summary = generate_summary(cx)
            scores = judge_summary(cx, summary)
        except Exception as e:
            print(f"ERROR: {e}")
            continue

        crit_scores = {c: scores.get(c, 0) for c in CRITERIA}
        avg = sum(crit_scores.values()) / len(CRITERIA)
        label = score_to_label(avg)
        passed += label in ("pass", "excellent")

        for c in CRITERIA:
            totals[c] += crit_scores[c]

        bar = "█" * int(avg) + "░" * (5 - int(avg))
        print(f"[{bar}] {avg:.1f}/5 {label.upper()}")

        results.append({
            "complex_id": cx["korter_id"],
            "name": cx["name"],
            "district": cx.get("district"),
            "stage": cx.get("construction_stage"),
            "price_avg": cx.get("price_avg"),
            "summary": summary,
            "scores": crit_scores,
            "avg_score": round(avg, 2),
            "label": label,
            "reasoning": scores.get("reasoning", ""),
        })

        time.sleep(0.3)  # be polite to the API

    if not results:
        print("No results.")
        return

    # ── Summary ───────────────────────────────────────────────────────────
    n_eval = len(results)
    pass_rate = passed / n_eval * 100
    global_avg = sum(r["avg_score"] for r in results) / n_eval
    per_criterion = {c: round(totals[c] / n_eval, 2) for c in CRITERIA}

    print(f"\n{'='*60}")
    print(f"RESULTS  ({n_eval} evaluated)")
    print(f"{'='*60}")
    print(f"  Pass rate : {pass_rate:.0f}%  ({passed}/{n_eval})")
    print(f"  Avg score : {global_avg:.2f} / 5.00")
    print()
    print("  Per criterion:")
    for c, s in per_criterion.items():
        bar = "█" * int(s) + "░" * (5 - int(s))
        print(f"    {c:<20} {bar} {s:.2f}")

    # worst cases
    worst = sorted(results, key=lambda r: r["avg_score"])[:3]
    print(f"\n  Worst cases (for prompt improvement):")
    for r in worst:
        print(f"    [{r['avg_score']:.1f}] {r['name'][:40]} — {r['reasoning'][:80]}...")

    report = {
        "meta": {
            "date": datetime.now().isoformat(),
            "model": "groq/llama-3.3-70b-versatile",
            "n_evaluated": n_eval,
            "pass_threshold": PASS_THRESHOLD,
        },
        "summary": {
            "pass_rate_pct": round(pass_rate, 1),
            "avg_score": round(global_avg, 2),
            "per_criterion": per_criterion,
        },
        "results": results,
    }

    if out:
        Path(out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n  Report saved → {out}")

    print(f"\n{'='*60}\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=20)
    parser.add_argument("--out", type=str, default="evals/report.json")
    args = parser.parse_args()
    run(args.n, args.out)
