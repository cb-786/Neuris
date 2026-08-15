import logging
from sqlalchemy import select
from app.db.database import async_session_factory
from app.db.tables import Conversation, Message, Memory
from app.models.conversation_models import TranscribedMessage
from app.models.memory_models import MemoryEntry

logger = logging.getLogger(__name__)

class MemoryStore:
    async def create_conversation(self, conversation_id: str, title: str = "New Conversation") -> str:
        async with async_session_factory() as session:
            conv = Conversation(id=conversation_id, title=title)
            session.add(conv)
            await session.commit()
            return conversation_id

    async def store_message(self, message_id: str, conversation_id: str, role: str, content: str, source: str, speaker: str = None):
        async with async_session_factory() as session:
            msg = Message(
                id=message_id,
                conversation_id=conversation_id,
                role=role,
                speaker=speaker,
                content=content,
                source=source
            )
            session.add(msg)
            await session.commit()

    async def store_memory(self, memory_id: str, conversation_id: str, content: str, summary: str, entity_ids: str):
        async with async_session_factory() as session:
            mem = Memory(
                id=memory_id,
                conversation_id=conversation_id,
                content=content,
                summary=summary,
                entity_ids=entity_ids
            )
            session.add(mem)
            await session.commit()

memory_store = MemoryStore()
