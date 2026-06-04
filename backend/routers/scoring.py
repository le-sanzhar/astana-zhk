"""
FastAPI router for scoring endpoints.
Computes or returns cached scores + AI summary.
"""
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from ..db.database import get_db
from ..db.models import Complex, PriceSnapshot, Infrastructure, ScoringCache
from ..services.scoring import compute_all_scores
from ..services.ai import generate_ai_summary
from ..services.gis import fetch_all_infrastructure
from ..schemas import ScoringResponse, ScoreOut

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.get("/{complex_id}", response_model=ScoringResponse)
async def get_scoring(
    complex_id: UUID,
    refresh: bool = False,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get scoring for a complex. Uses cache unless refresh=true.
    """
    # Load complex with relations
    query = (
        select(Complex)
        .where(Complex.id == complex_id)
        .options(
            selectinload(Complex.price_snapshots),
            selectinload(Complex.infrastructure),
            selectinload(Complex.scores),
        )
    )
    result = await db.execute(query)
    c = result.scalar_one_or_none()

    if not c:
        raise HTTPException(404, "ЖК не найден")

    # Use cached scores if available and not forcing refresh
    if c.scores and not refresh:
        ai_summary = next((s.ai_summary for s in c.scores if s.ai_summary), None)
        return ScoringResponse(
            scores=[ScoreOut.model_validate(s) for s in c.scores],
            ai_summary=ai_summary,
        )

    # Fetch infrastructure if missing and coords available
    if not c.infrastructure and c.latitude and c.longitude:
        infra_items = await fetch_all_infrastructure(
            float(c.latitude), float(c.longitude)
        )
        # Save to DB
        for item in infra_items:
            infra = Infrastructure(
                complex_id=c.id,
                type=item["type"],
                name=item.get("name"),
                distance_meters=item.get("distance_meters"),
                latitude=item.get("latitude"),
                longitude=item.get("longitude"),
            )
            db.add(infra)
        await db.commit()
        # Reload
        await db.refresh(c, ["infrastructure"])

    # Compute scores
    sorted_snaps = sorted(c.price_snapshots, key=lambda s: s.recorded_at)
    score_results = compute_all_scores(
        price_snapshots=sorted_snaps,
        infra=c.infrastructure,
        stage=c.construction_stage,
        completion_date=c.completion_date,
    )

    # Generate AI summary
    complex_data = {
        "name": c.name,
        "developer": c.developer,
        "district": c.district,
        "construction_stage": c.construction_stage,
        "price_avg": sorted_snaps[-1].price_avg if sorted_snaps else None,
        "listings_count": sorted_snaps[-1].listings_count if sorted_snaps else None,
    }
    scores_dicts = [
        {"profile": r.profile, "score": r.score, "explanation": r.explanation}
        for r in score_results
    ]
    ai_summary = await generate_ai_summary(complex_data, scores_dicts)

    # Clear old cache and save new
    await db.execute(delete(ScoringCache).where(ScoringCache.complex_id == c.id))
    for r in score_results:
        cache = ScoringCache(
            complex_id=c.id,
            profile=r.profile,
            score=r.score,
            score_value=r.score_value,
            explanation=r.explanation,
            ai_summary=ai_summary if r.profile == "investor" else None,
        )
        db.add(cache)
    await db.commit()

    return ScoringResponse(
        scores=[
            ScoreOut(
                profile=r.profile,
                score=r.score,
                score_value=r.score_value,
                explanation=r.explanation,
            )
            for r in score_results
        ],
        ai_summary=ai_summary,
    )
