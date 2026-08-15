import json
import logging
from app.db.database import async_session_factory
from app.db.tables import AnalyticsEvent

logger = logging.getLogger(__name__)

class AnalyticsService:
    async def log_event(self, event_type: str, payload: dict):
        """Logs an event to the analytics_events SQLite table asynchronously."""
        async with async_session_factory() as session:
            try:
                event = AnalyticsEvent(
                    event_type=event_type,
                    payload=json.dumps(payload)
                )
                session.add(event)
                await session.commit()
            except Exception as e:
                logger.error(f"Failed to log analytics event {event_type}: {e}")

analytics_service = AnalyticsService()
