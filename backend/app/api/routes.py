import time
import uuid
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from app.api.deps import get_current_user
from app.models.conversation_models import TextInput, TranscribedMessage
from app.services.audio_pipeline import audio_pipeline
from app.services.graphrag import graphrag_service
from app.services.background_tasks import process_conversation_background
from app.services.memory_store import memory_store
from app.services.cache import cache_service
from app.services.analytics import analytics_service
from app.services.post_processor import post_processor
from app.db.database import async_session_factory
from app.db.tables import Memory, AnalyticsEvent
from sqlalchemy import select, func

router = APIRouter(prefix="/v1", tags=["v1"])

@router.post("/conversations/ingest")
async def ingest_text(
    input_data: TextInput, 
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    start_time = time.time()
    
    # 1. Pipeline: Process Text
    transcribed_msg = await audio_pipeline.process_text(input_data.text)
    
    # Process downstream
    response = await _process_downstream(transcribed_msg, background_tasks, start_time)
    return response

@router.post("/conversations/ingest/audio")
async def ingest_audio(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    language: str = Form("en-US"),
    user: dict = Depends(get_current_user)
):
    start_time = time.time()
    
    # Read bytes
    audio_bytes = await audio.read()
    
    try:
        # 1. Pipeline: Process Audio (STT + Diarization)
        transcribed_msg = await audio_pipeline.process_audio(audio_bytes, language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Process downstream
    response = await _process_downstream(transcribed_msg, background_tasks, start_time, stt_duration=time.time()-start_time)
    return response

async def _process_downstream(msg: TranscribedMessage, background_tasks: BackgroundTasks, start_time: float, stt_duration: float = 0):
    conversation_id = f"conv_{uuid.uuid4().hex[:8]}"
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    
    # 1. Store Message
    await memory_store.create_conversation(conversation_id, title=msg.full_text[:30])
    await memory_store.store_message(
        msg_id, conversation_id, role="user", content=msg.full_text, source=msg.source
    )
    
    # 2. Cache Check (for search queries inside the ingest)
    cache_key = f"rag_search:{msg.full_text}"
    cached_response = await cache_service.get(cache_key)
    
    if cached_response:
        ai_response = cached_response
        cache_hit = True
    else:
        # 3. GraphRAG Retrieval & Synthesis
        cache_hit = False
        ai_response = await graphrag_service.retrieve_and_synthesize(msg.full_text)
        
        # Redact PII
        ai_response["response"] = post_processor.redact_pii(ai_response.get("response", ""))
        
        # Cache the result
        await cache_service.set(cache_key, ai_response)

    # 4. Trigger Background Memory Update
    background_tasks.add_task(process_conversation_background, conversation_id, msg.full_text)
    
    # 5. Log Analytics
    latency = (time.time() - start_time) * 1000
    await analytics_service.log_event("query", {
        "query": msg.full_text,
        "latency_ms": latency,
        "stt_duration_ms": stt_duration * 1000,
        "cache_hit": cache_hit,
        "source": msg.source
    })
    
    return {
        "status": "success",
        "conversation_id": conversation_id,
        "transcript": msg.model_dump(),
        "ai_response": ai_response,
        "cached": cache_hit,
        "latency_ms": round(latency, 2)
    }

@router.get("/search/rag")
async def search_rag(q: str):
    start_time = time.time()
    cache_key = f"rag_search:{q}"
    cached = await cache_service.get(cache_key)
    
    if cached:
        latency = (time.time() - start_time) * 1000
        await analytics_service.log_event("search", {"query": q, "latency_ms": latency, "cache_hit": True})
        return {"status": "success", "cached": True, "data": cached, "latency_ms": latency}
        
    ai_response = await graphrag_service.retrieve_and_synthesize(q)
    ai_response["response"] = post_processor.redact_pii(ai_response.get("response", ""))
    
    await cache_service.set(cache_key, ai_response)
    
    latency = (time.time() - start_time) * 1000
    await analytics_service.log_event("search", {"query": q, "latency_ms": latency, "cache_hit": False})
    
    return {"status": "success", "cached": False, "data": ai_response, "latency_ms": latency}

@router.get("/memories")
async def get_memories():
    async with async_session_factory() as session:
        result = await session.execute(select(Memory).order_by(Memory.created_at.desc()).limit(50))
        memories = result.scalars().all()
        return {"status": "success", "data": [{"id": m.id, "summary": m.summary, "content": m.content[:100]} for m in memories]}

@router.get("/analytics/summary")
async def get_analytics_summary():
    async with async_session_factory() as session:
        total_queries = await session.execute(select(func.count(AnalyticsEvent.id)))
        total_queries = total_queries.scalar() or 0
        return {"status": "success", "data": {"total_queries": total_queries}}
