"""
FastAPI router for residential complexes endpoints.
"""
from typing import Optional, List
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from ..db.database import get_db
from ..db.models import Complex, PriceSnapshot, Infrastructure, ScoringCache
from ..schemas import ComplexListItem, ComplexDetail, ComplexListResponse, CompareResponse, PriceSnapshotOut, InfrastructureOut, ScoreOut

router = APIRouter(prefix="/api/complexes", tags=["complexes"])


@router.get("", response_model=ComplexListResponse)
async def list_complexes(
    district: Optional[str] = Query(None, description="Фильтр по району"),
    stage: Optional[str] = Query(None, description="Стадия: commissioned, under_construction, foundation, planned"),
    profile: Optional[str] = Query(None, description="Профиль: investor, family, student"),
    min_price: Optional[float] = Query(None, description="Мин. цена за м² в тенге"),
    max_price: Optional[float] = Query(None, description="Макс. цена за м² в тенге"),
    sort_by: str = Query("updated_at", description="Сортировка: updated_at, price_avg, score"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all complexes with filters and pagination."""

    # Base query
    query = select(Complex).options(
        selectinload(Complex.scores)
    )

    # Filters
    if district:
        query = query.where(Complex.district.ilike(f"%{district}%"))
    if stage:
        query = query.where(Complex.construction_stage == stage)

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_q) or 0

    # Sorting
    if sort_by == "price_avg":
        query = query.order_by(Complex.updated_at.desc())
    else:
        query = query.order_by(Complex.updated_at.desc())

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    complexes = result.scalars().all()

    # Enrich with latest price snapshot
    items = []
    for c in complexes:
        # Get latest snapshot
        snap_q = (
            select(PriceSnapshot)
            .where(PriceSnapshot.complex_id == c.id)
            .order_by(desc(PriceSnapshot.recorded_at))
            .limit(1)
        )
        snap_result = await db.execute(snap_q)
        latest_snap = snap_result.scalar_one_or_none()

        # Score map
        score_map = {s.profile: s.score for s in c.scores}

        # Price filter (post-fetch, since it's in snapshots)
        if latest_snap:
            if min_price and latest_snap.price_avg and float(latest_snap.price_avg) < min_price:
                continue
            if max_price and latest_snap.price_avg and float(latest_snap.price_avg) > max_price:
                continue

        # Profile filter
        if profile:
            target_score = score_map.get(profile)
            if target_score not in ("green", "yellow"):
                if profile:  # skip reds if profile filter applied
                    pass  # include all for now, frontend can filter

        item = ComplexListItem(
            id=c.id,
            name=c.name,
            developer=c.developer,
            district=c.district,
            construction_stage=c.construction_stage,
            completion_date=c.completion_date,
            price_avg=latest_snap.price_avg if latest_snap else None,
            price_min=latest_snap.price_min if latest_snap else None,
            listings_count=latest_snap.listings_count if latest_snap else None,
            investor_score=score_map.get("investor"),
            family_score=score_map.get("family"),
            student_score=score_map.get("student"),
        )
        items.append(item)

    return ComplexListResponse(total=total, items=items)


@router.get("/compare", response_model=CompareResponse)
async def compare_complexes(
    ids: str = Query(..., description="Comma-separated complex UUIDs"),
    db: AsyncSession = Depends(get_db),
):
    """Compare two complexes side by side."""
    id_list = [uid.strip() for uid in ids.split(",")][:2]
    if len(id_list) < 2:
        raise HTTPException(400, "Укажите два ID через запятую")

    results = []
    for cid in id_list:
        try:
            uuid_val = UUID(cid)
        except ValueError:
            raise HTTPException(400, f"Некорректный UUID: {cid}")

        detail = await _get_complex_detail(uuid_val, db)
        if not detail:
            raise HTTPException(404, f"ЖК не найден: {cid}")
        results.append(detail)

    return CompareResponse(complexes=results)


@router.get("/{complex_id}", response_model=ComplexDetail)
async def get_complex(
    complex_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get full complex details with price history, infra, and scores."""
    detail = await _get_complex_detail(complex_id, db)
    if not detail:
        raise HTTPException(404, "ЖК не найден")
    return detail


async def _get_complex_detail(complex_id: UUID, db: AsyncSession) -> Optional[ComplexDetail]:
    """Shared logic for fetching a complex with all relations."""
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
        return None

    # Sort price history ascending
    sorted_snaps = sorted(c.price_snapshots, key=lambda s: s.recorded_at)

    # AI summary from cache
    ai_summary = None
    for s in c.scores:
        if s.ai_summary:
            ai_summary = s.ai_summary
            break

    return ComplexDetail(
        id=c.id,
        name=c.name,
        developer=c.developer,
        address=c.address,
        district=c.district,
        latitude=c.latitude,
        longitude=c.longitude,
        construction_stage=c.construction_stage,
        completion_date=c.completion_date,
        total_floors=c.total_floors,
        total_apartments=c.total_apartments,
        krisha_url=c.krisha_url,
        price_snapshots=[
            PriceSnapshotOut.model_validate(s) for s in sorted_snaps
        ],
        infrastructure=[
            InfrastructureOut.model_validate(i) for i in c.infrastructure
        ],
        scores=[
            ScoreOut.model_validate(s) for s in c.scores
        ],
        ai_summary=ai_summary,
    )
