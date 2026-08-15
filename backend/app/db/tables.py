from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"))
    role = Column(String)  # 'user' or 'ai'
    speaker = Column(String, nullable=True) # e.g., 'Speaker 1', 'user'
    content = Column(Text)
    source = Column(String) # 'text' or 'audio'
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Memory(Base):
    __tablename__ = "memories"

    id = Column(String, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="CASCADE"))
    content = Column(Text)
    summary = Column(Text)
    entity_ids = Column(String)  # Comma-separated or JSON list of Neo4j entity IDs
    embedding_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, index=True)
    payload = Column(Text) # JSON string
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
