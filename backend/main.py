"""
FastAPI application entry point.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from dotenv import load_dotenv

from .db.database import engine, Base
from .routers import complexes, scoring

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("Starting Astana ZhK API...")
    # Create tables if they don't exist (fallback, prefer SQL migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database ready")
    yield
    logger.info("Shutting down...")
    await engine.dispose()


app = FastAPI(
    title="Astana ZhK Analyzer API",
    description="Анализатор жилых комплексов Астаны — скоринг по профилям покупателя",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(complexes.router)
app.include_router(scoring.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "astana-zhk-api"}
