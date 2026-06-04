"""
SQLAlchemy ORM models — mirror of migrations/001_init.sql
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Numeric, Integer, Date, DateTime, ForeignKey,
    UniqueConstraint, Text, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from .database import Base


class Complex(Base):
    __tablename__ = "complexes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    developer: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(String(500))
    district: Mapped[Optional[str]] = mapped_column(String(100))
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 8))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(11, 8))
    construction_stage: Mapped[Optional[str]] = mapped_column(String(50))
    completion_date: Mapped[Optional[date]] = mapped_column(Date)
    krisha_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    krisha_url: Mapped[Optional[str]] = mapped_column(Text)
    total_floors: Mapped[Optional[int]] = mapped_column(Integer)
    total_apartments: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    price_snapshots: Mapped[List["PriceSnapshot"]] = relationship(back_populates="complex", cascade="all, delete-orphan")
    infrastructure: Mapped[List["Infrastructure"]] = relationship(back_populates="complex", cascade="all, delete-orphan")
    scores: Mapped[List["ScoringCache"]] = relationship(back_populates="complex", cascade="all, delete-orphan")


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complex_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("complexes.id", ondelete="CASCADE"), nullable=False)
    price_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    price_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    price_avg: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    total_area_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    total_area_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    listings_count: Mapped[Optional[int]] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    complex: Mapped["Complex"] = relationship(back_populates="price_snapshots")


class Infrastructure(Base):
    __tablename__ = "infrastructure"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complex_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("complexes.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    distance_meters: Mapped[Optional[int]] = mapped_column(Integer)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 8))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(11, 8))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    complex: Mapped["Complex"] = relationship(back_populates="infrastructure")


class ScoringCache(Base):
    __tablename__ = "scoring_cache"
    __table_args__ = (UniqueConstraint("complex_id", "profile"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    complex_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("complexes.id", ondelete="CASCADE"), nullable=False)
    profile: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[str] = mapped_column(String(10), nullable=False)
    score_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 2))
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    complex: Mapped["Complex"] = relationship(back_populates="scores")
