import logging
import uuid
from app.services.graphrag import graphrag_service
from app.services.memory_store import memory_store
from app.services.cache import cache_service

logger = logging.getLogger(__name__)

async def process_conversation_background(conversation_id: str, transcript: str):
    """
    Background pipeline to execute after a conversation finishes:
    1. Extract entities & relationships via LLM.
    2. Write to Neo4j.
    3. Store memory in SQLite.
    4. Optional: Cache invalidation.
    """
    logger.info(f"Starting background memory update for conversation: {conversation_id}")
    try:
        # Extract and write to Neo4j
        summary = await graphrag_service.extract_and_store(transcript, conversation_id)
        
        # Store in SQLite Memory Table
        memory_id = f"mem_{uuid.uuid4().hex[:8]}"
        # The 'content' could be the full transcript, and 'summary' is the LLM generated summary if we had one.
        # For now, we will store the raw extraction info as summary.
        entity_ids = ",".join([node.id for node in summary.get("nodes_written", [])]) if isinstance(summary.get("nodes_written"), list) else ""
        
        await memory_store.store_memory(
            memory_id=memory_id,
            conversation_id=conversation_id,
            content=transcript,
            summary=f"Extracted {summary.get('nodes_written')} nodes and {summary.get('edges_written')} edges.",
            entity_ids=entity_ids
        )
        
        logger.info(f"Background memory update completed for conversation: {conversation_id}")
    except Exception as e:
        logger.error(f"Background pipeline failed for {conversation_id}: {e}")
