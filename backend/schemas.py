"""
Pydantic schemas for FastAPI request/response serialization.
"""
from __future__ import annotations
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ─────────────────────────────────────────
# Price
# ─────────────────────────────────────────

class PriceSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    price_min: Optional[Decimal]
    price_max: Optional[Decimal]
    price_avg: Optional[Decimal]
    listings_count: Optional[int]
    recorded_at: datetime


# ─────────────────────────────────────────
# Infrastructure
# ─────────────────────────────────────────

class InfrastructureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type: str
    name: Optional[str]
    distance_meters: Optional[int]


# ─────────────────────────────────────────
# Scoring
# ─────────────────────────────────────────

class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile: str
    score: str          # 'green' | 'yellow' | 'red'
    score_value: Optional[Decimal]
    explanation: Optional[str]


class ScoringResponse(BaseModel):
    scores: List[ScoreOut]
    ai_summary: Optional[str]


# ─────────────────────────────────────────
# Complex
# ─────────────────────────────────────────

class ComplexListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    developer: Optional[str]
    district: Optional[str]
    construction_stage: Optional[str]
    completion_date: Optional[date]
    # Latest snapshot prices
    price_avg: Optional[Decimal] = None
    price_min: Optional[Decimal] = None
    listings_count: Optional[int] = None
    # Scores
    investor_score: Optional[str] = None
    family_score: Optional[str] = None
    student_score: Optional[str] = None


class ComplexDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    developer: Optional[str]
    address: Optional[str]
    district: Optional[str]
    latitude: Optional[Decimal]
    longitude: Optional[Decimal]
    construction_stage: Optional[str]
    completion_date: Optional[date]
    total_floors: Optional[int]
    total_apartments: Optional[int]
    krisha_url: Optional[str]
    price_snapshots: List[PriceSnapshotOut] = []
    infrastructure: List[InfrastructureOut] = []
    scores: List[ScoreOut] = []
    ai_summary: Optional[str] = None


class ComplexListResponse(BaseModel):
    total: int
    items: List[ComplexListItem]


class CompareResponse(BaseModel):
    complexes: List[ComplexDetail]
