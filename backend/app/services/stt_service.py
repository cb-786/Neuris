import logging
import asyncio
from typing import List

from google.cloud import speech_v2
from google.cloud.speech_v2.types import cloud_speech

from app.core.config import settings
from app.models.conversation_models import TranscriptionResult, DiarizedWord

logger = logging.getLogger(__name__)

class STTService:
    def __init__(self):
        self.project_id = settings.GCP_PROJECT_ID
        self.language_code = settings.STT_LANGUAGE_CODE
        self.max_speakers = settings.STT_MAX_SPEAKERS
        self.model = settings.STT_MODEL
        
        try:
            self.client = speech_v2.SpeechClient()
            logger.info("STTService initialized with Google Cloud Speech-to-Text V2.")
        except Exception as e:
            logger.warning(f"Could not initialize STTService: {e}")
            self.client = None

    def _parse_response(self, response) -> TranscriptionResult:
        full_transcript = ""
        words: List[DiarizedWord] = []
        speaker_count = 0
        speakers_seen = set()

        for result in response.results:
            if not result.alternatives:
                continue
            
            alternative = result.alternatives[0]
            full_transcript += alternative.transcript + " "

            for word_info in alternative.words:
                start_time = word_info.start_offset.seconds + (word_info.start_offset.microseconds / 1e6)
                end_time = word_info.end_offset.seconds + (word_info.end_offset.microseconds / 1e6)
                speaker_tag = word_info.speaker_label or 1 # Fallback to 1 if not detected
                
                # Convert string 'speaker_1' to int if necessary, or just keep it simple
                try:
                    speaker_id = int(str(speaker_tag).replace('speaker_', ''))
                except ValueError:
                    speaker_id = 1

                speakers_seen.add(speaker_id)
                words.append(DiarizedWord(
                    word=word_info.word,
                    start_time=start_time,
                    end_time=end_time,
                    speaker_tag=speaker_id
                ))

        speaker_count = len(speakers_seen)
        
        return TranscriptionResult(
            full_transcript=full_transcript.strip(),
            words=words,
            speaker_count=speaker_count
        )

    async def transcribe(self, audio_bytes: bytes, language: str = None) -> TranscriptionResult:
        if not self.client:
            raise RuntimeError("STT client not initialized. Check GCP credentials.")

        lang = language or self.language_code

        config = cloud_speech.RecognitionConfig(
            auto_decoding_config=cloud_speech.AutoDecodingConfig(),
            language_codes=[lang],
            model=self.model,
            features=cloud_speech.RecognitionFeatures(
                enable_automatic_punctuation=True,
                enable_word_time_offsets=True,
                diarization_config=cloud_speech.SpeakerDiarizationConfig(
                    min_speaker_count=1,
                    max_speaker_count=self.max_speakers,
                ),
            ),
        )

        request = cloud_speech.RecognizeRequest(
            recognizer=f"projects/{self.project_id}/locations/global/recognizers/_",
            config=config,
            content=audio_bytes,
        )

        try:
            logger.info("Sending audio to Google Cloud STT...")
            # Run the synchronous GRPC call in a thread pool to avoid blocking the event loop
            response = await asyncio.to_thread(self.client.recognize, request=request)
            return self._parse_response(response)
        except Exception as e:
            logger.error(f"STT Transcription failed: {e}")
            raise e

stt_service = STTService()
