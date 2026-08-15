"""
Hydrate vector embeddings for existing nodes in Neo4j.
Run as: python scripts/hydrate_vectors.py
"""
import asyncio
import logging
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.neo4j_service import neo4j_service
from app.services.llm import llm_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def hydrate():
    await neo4j_service.connect()
    driver = neo4j_service._require_driver()

    async with driver.session() as session:
        # Find nodes that have no embedding yet
        result = await session.run(
            "MATCH (n:Entity) WHERE n.embedding IS NULL RETURN n.id AS id, n.name AS name"
        )
        records = await result.data()

    if not records:
        logger.info("All Entity nodes already have embeddings. Nothing to hydrate.")
        await neo4j_service.disconnect()
        return

    logger.info(f"Hydrating {len(records)} nodes...")
    for record in records:
        node_id = record["id"]
        name = record["name"]
        try:
            embedding = await llm_service.generate_embedding(name)
            async with driver.session() as session:
                await session.run(
                    "MATCH (n:Entity {id: $id}) SET n.embedding = $embedding",
                    id=node_id, embedding=embedding
                )
            logger.info(f"  ✓ {node_id}")
        except Exception as e:
            logger.error(f"  ✗ {node_id}: {e}")

    await neo4j_service.disconnect()
    logger.info("Hydration complete.")

if __name__ == "__main__":
    asyncio.run(hydrate())
