from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import init_db
from app.services.neo4j_service import neo4j_service
from app.api.routes import router as api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan handler — runs startup logic before yield,
    shutdown logic after.
    """
    logger.info("Starting up NEURIS API...")
    await init_db()
    try:
        await neo4j_service.connect()
    except Exception as e:
        logger.warning(f"Neo4j connection failed at startup: {e}")
    
    yield  # ← app runs here

    logger.info("Shutting down NEURIS API...")
    await neo4j_service.disconnect()


app = FastAPI(
    title       = settings.APP_NAME,
    description = "NEURIS Memory Intelligence System",
    version     = "1.0.0",
    docs_url    = "/api/docs",
    redoc_url   = "/api/redoc",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins    = settings.ALLOWED_ORIGINS,
    allow_credentials= True,
    allow_methods    = ["*"],
    allow_headers    = ["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {
        "status":  "OK",
        "service": settings.APP_NAME,
        "version": "1.0.0",
    }
