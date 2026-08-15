import re
import logging

logger = logging.getLogger(__name__)

class PostProcessor:
    def redact_pii(self, text: str) -> str:
        """Basic regex-based PII redaction."""
        # Simple email redaction
        text = re.sub(r'[\w\.-]+@[\w\.-]+', '[EMAIL REDACTED]', text)
        # Simple phone redaction (US format roughly)
        text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE REDACTED]', text)
        return text

    def validate_entities(self, referenced_entities: list[str], available_entities: list[dict]) -> list[str]:
        """Ensures the LLM didn't hallucinate entities not in the context."""
        valid = set(e["entity"] for e in available_entities)
        return [ent for ent in referenced_entities if ent in valid]

post_processor = PostProcessor()
