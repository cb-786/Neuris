from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class EntityReference(BaseModel):
    id: str
    label: str
    name: str

class MemoryEntry(BaseModel):
    id: str
    conversation_id: str
    content: str
    summary: str
    entity_refs: List[EntityReference] = []
    created_at: datetime

class ConversationSummary(BaseModel):
    conversation_id: str
    summary: str
    key_entities: List[str] = []
