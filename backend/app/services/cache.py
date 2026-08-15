import json
import logging
import re
from typing import Any, Optional
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self.redis_host = settings.REDIS_HOST
        self.redis_port = settings.REDIS_PORT
        self.client: Optional[redis.Redis] = None
        self._connect()

    def _connect(self):
        try:
            self.client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                decode_responses=True,
                socket_timeout=2.0
            )
            logger.info(f"Connected to Redis cache at {self.redis_host}:{self.redis_port}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.client = None
            
    def _normalize_key(self, key: str) -> str:
        # Simple string normalization (lowercase, strip, collapse whitespace)
        normalized = re.sub(r"\s+", " ", key.strip().lower())
        return f"neuris_cache:{normalized}"

    async def get(self, key: str) -> Optional[Any]:
        if not self.client:
            return None
        try:
            norm_key = self._normalize_key(key)
            data = await self.client.get(norm_key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        if not self.client:
            return False
        try:
            norm_key = self._normalize_key(key)
            serialized_value = json.dumps(value)
            await self.client.setex(norm_key, ttl, serialized_value)
            return True
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False
            
    async def ping(self) -> bool:
        if not self.client:
            return False
        try:
            return await self.client.ping()
        except Exception:
            return False

cache_service = CacheService()
