from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "NEURIS API"
    DEBUG: bool = True
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:80",
        "http://localhost:3000",
        "http://localhost:5173",
        "null"
    ]

    # ── Gemini LLM ────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-004"

    # ── Google Cloud STT ──────────────────────────────────────────────────────
    GCP_PROJECT_ID: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = "/app/credentials/gcp-service-account.json"
    STT_LANGUAGE_CODE: str = "en-US"
    STT_MAX_SPEAKERS: int = 6
    GCP_BUCKET_NAME: str = "anubhav0101neuris"
    GCP_STT_BUCKET_NAME: str = "anubhav0101neuris"
    STT_MODEL: str = "chirp_3"

    # ── Neo4j ─────────────────────────────────────────────────────────────────
    NEO4J_URI: str = "bolt://neo4j:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "changeme"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    
    # ── SQLite ────────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/neuris.db"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
