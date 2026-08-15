import logging
import time
from typing import List

from app.models.conversation_models import TranscribedMessage, DiarizedSegment, DiarizedWord
from app.services.stt_service import stt_service

logger = logging.getLogger(__name__)

class AudioPipeline:

    async def process_text(self, text: str) -> TranscribedMessage:
        """Text mode — wraps raw text, no STT needed."""
        # We assign a default speaker and current timestamp for text mode
        current_time = time.time()
        segment = DiarizedSegment(
            speaker="user",
            text=text,
            start_time=0.0,
            end_time=0.0
        )
        return TranscribedMessage(
            segments=[segment],
            full_text=text,
            speaker_count=1,
            source="text",
        )

    async def process_audio(self, audio_bytes: bytes, language: str = "en-US") -> TranscribedMessage:
        """Audio mode — calls Google STT, then groups words into speaker segments."""
        logger.info(f"Processing audio payload ({len(audio_bytes)} bytes)")
        
        # 1. Call STT service
        raw_result = await stt_service.transcribe(audio_bytes, language)

        # 2. Group words by speaker tag into contiguous segments
        segments = self._group_by_speaker(raw_result.words)

        # 3. Build the unified message
        return TranscribedMessage(
            segments=segments,
            full_text=raw_result.full_transcript,
            speaker_count=raw_result.speaker_count,
            source="audio",
        )

    def _group_by_speaker(self, words: List[DiarizedWord]) -> List[DiarizedSegment]:
        if not words:
            return []

        segments = []
        current_speaker = words[0].speaker_tag
        current_text_parts = [words[0].word]
        start_time = words[0].start_time
        end_time = words[0].end_time

        for word in words[1:]:
            if word.speaker_tag == current_speaker:
                current_text_parts.append(word.word)
                end_time = word.end_time
            else:
                # Flush the current segment
                segments.append(DiarizedSegment(
                    speaker=f"Speaker {current_speaker}",
                    text=" ".join(current_text_parts),
                    start_time=start_time,
                    end_time=end_time
                ))
                # Start new segment
                current_speaker = word.speaker_tag
                current_text_parts = [word.word]
                start_time = word.start_time
                end_time = word.end_time

        # Flush the final segment
        segments.append(DiarizedSegment(
            speaker=f"Speaker {current_speaker}",
            text=" ".join(current_text_parts),
            start_time=start_time,
            end_time=end_time
        ))

        return segments

audio_pipeline = AudioPipeline()
