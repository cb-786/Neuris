import logging
import asyncio
import uuid
import json
import os
from typing import List, Tuple, Optional
from google.cloud import speech_v1 as speech
from google.cloud import storage
from google.oauth2 import service_account
from google.api_core.exceptions import GoogleAPICallError, NotFound, Forbidden

from app.core.config import settings
from app.models.conversation_models import TranscriptionResult, DiarizedWord

logger = logging.getLogger(__name__)

class STTService:
    def __init__(self):
        self.project_id = settings.GCP_PROJECT_ID
        self.language_code = settings.STT_LANGUAGE_CODE
        self.max_speakers = settings.STT_MAX_SPEAKERS
        
        # Load bucket name from settings or env
        self.bucket_name = (
            getattr(settings, "GCP_BUCKET_NAME", None)
            or getattr(settings, "GCP_STT_BUCKET_NAME", None)
            or os.environ.get("GCP_BUCKET_NAME")
            or os.environ.get("GCP_STT_BUCKET_NAME")
            or ""
        )

        # 1. Explicitly load service account credentials from JSON file
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", settings.GOOGLE_APPLICATION_CREDENTIALS)
        self.credentials = None
        
        if cred_path and os.path.exists(cred_path):
            try:
                self.credentials = service_account.Credentials.from_service_account_file(cred_path)
                if not self.project_id or self.project_id == "your_gcp_project_id":
                    self.project_id = self.credentials.project_id
                logger.info(
                    f"[STTService] Loaded credentials for service account: "
                    f"{getattr(self.credentials, 'service_account_email', 'unknown')} | project={self.project_id}"
                )
            except Exception as e:
                logger.error(f"[STTService] Failed to load credentials from {cred_path}: {e}")

        # 2. Initialize SpeechClient with exact same credentials
        try:
            if self.credentials:
                self.client = speech.SpeechClient(credentials=self.credentials)
            else:
                self.client = speech.SpeechClient()
            logger.info("[STTService] SpeechClient initialized successfully.")
        except Exception as e:
            logger.error(f"[STTService] Could not initialize SpeechClient: {e}")
            self.client = None

        # 3. Initialize GCS StorageClient with exact same credentials
        try:
            if self.credentials:
                self.storage_client = storage.Client(credentials=self.credentials, project=self.project_id)
            else:
                self.storage_client = storage.Client(project=self.project_id)
            logger.info(
                f"[STTService] GCS StorageClient initialized successfully (target bucket='{self.bucket_name}')."
            )
        except Exception as e:
            logger.error(f"[STTService] Could not initialize GCS StorageClient: {e}")
            self.storage_client = None

    async def upload_audio_to_gcs(self, audio_bytes: bytes) -> Tuple[str, storage.Blob]:
        """
        Uploads audio bytes to GCS bucket and returns the gs:// URI and Blob reference.
        Provides verbose logging for tracking permissions, bucket existence, and upload status.
        """
        if not self.storage_client:
            raise RuntimeError(
                "GCS Storage client is not initialized. Please verify your GCP service account credentials."
            )

        if not self.bucket_name:
            raise ValueError(
                "GCP_BUCKET_NAME environment variable is missing. "
                "Please set GCP_BUCKET_NAME in your backend/.env file."
            )

        filename = f"audio_{uuid.uuid4().hex}.webm"
        gcs_uri = f"gs://{self.bucket_name}/{filename}"
        sa_email = getattr(self.credentials, "service_account_email", "default application credentials")

        logger.info(
            f"[GCS Upload] Initiating upload of {len(audio_bytes)} bytes to '{gcs_uri}'\n"
            f"  • Project: {self.project_id}\n"
            f"  • Bucket: {self.bucket_name}\n"
            f"  • Service Account: {sa_email}\n"
            f"  • Content-Type: audio/webm"
        )

        try:
            bucket = self.storage_client.bucket(self.bucket_name)
            blob = bucket.blob(filename)
            
            # Upload string buffer to GCS asynchronously
            await asyncio.to_thread(blob.upload_from_string, audio_bytes, content_type="audio/webm")
            
            logger.info(f"[GCS Upload Success] Audio file available at: {gcs_uri}")
            return gcs_uri, blob

        except Forbidden as e:
            logger.error(
                f"[GCS Permission Denied] 403 Forbidden while uploading to '{gcs_uri}':\n"
                f"  • Service Account: {sa_email}\n"
                f"  • Error: {e}\n"
                f"  • Required Action: Grant 'Storage Object Admin' (roles/storage.objectAdmin) or 'Storage Admin' "
                f"to '{sa_email}' on bucket '{self.bucket_name}' or project '{self.project_id}'."
            )
            raise RuntimeError(
                f"Permission denied on GCS bucket '{self.bucket_name}'. "
                f"Ensure '{sa_email}' has the 'Storage Object Admin' role."
            ) from e

        except NotFound as e:
            logger.error(
                f"[GCS Bucket Not Found] 404 Not Found for bucket '{self.bucket_name}':\n"
                f"  • Error: {e}\n"
                f"  • Required Action: Please create bucket '{self.bucket_name}' in the Google Cloud Console "
                f"under project '{self.project_id}'."
            )
            raise RuntimeError(
                f"GCS bucket '{self.bucket_name}' does not exist. "
                f"Please create it in your Google Cloud Console."
            ) from e

        except GoogleAPICallError as e:
            logger.error(f"[GCS API Error] Failed uploading to '{gcs_uri}': {e}")
            raise RuntimeError(f"GCS upload failed: {e}") from e

        except Exception as e:
            logger.error(f"[GCS Unexpected Error] Failed uploading to '{gcs_uri}': {e}")
            raise e

    def _parse_response(self, response) -> TranscriptionResult:
        full_transcript = ""
        words: List[DiarizedWord] = []
        speakers_seen = set()

        if not response.results:
            return TranscriptionResult(full_transcript="", words=[], speaker_count=0)

        # 1. Accumulate full transcript across all utterances
        for result in response.results:
            if result.alternatives and result.alternatives[0].transcript:
                full_transcript += result.alternatives[0].transcript + " "

        # 2. Extract diarized words
        # In Google Cloud Speech V1, if diarization is enabled, it often appends a final pseudo-result
        # that contains no transcript but has all the diarized words for the entire audio.
        # If this pseudo-result is present, we only extract words from it.
        # Otherwise, the diarized words are distributed across the individual result chunks.
        last_result = response.results[-1] if response.results else None
        is_pseudo_result = False
        
        if last_result and last_result.alternatives:
            last_alt = last_result.alternatives[0]
            has_transcript = bool(last_alt.transcript.strip())
            has_words = len(last_alt.words) > 0
            # If the last result has words but no transcript, it's the aggregated pseudo-result
            if not has_transcript and has_words:
                is_pseudo_result = True

        if is_pseudo_result:
            # Final result contains the aggregated words for the entire audio
            target_results = [last_result]
        else:
            # Each result chunk contains its own words in sequence
            target_results = response.results

        for result in target_results:
            if not result.alternatives:
                continue
            alternative = result.alternatives[0]
            for word_info in alternative.words:
                start_time = word_info.start_time.total_seconds()
                end_time = word_info.end_time.total_seconds()
                speaker_tag = getattr(word_info, "speaker_tag", 1) or 1
                
                try:
                    speaker_id = int(str(speaker_tag).replace("speaker_", ""))
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
        logger.info(
            f"[STT Result] Extracted {len(words)} words across {speaker_count} speaker(s): {sorted(list(speakers_seen))}"
        )
        
        return TranscriptionResult(
            full_transcript=full_transcript.strip(),
            words=words,
            speaker_count=speaker_count
        )

    async def transcribe(self, audio_bytes: bytes, language: str = None) -> TranscriptionResult:
        if not self.client:
            raise RuntimeError("STT client not initialized. Check GCP credentials.")

        lang = language or self.language_code

        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            language_code=lang,
            model="latest_long",
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,
            diarization_config=speech.SpeakerDiarizationConfig(
                enable_speaker_diarization=True,
                min_speaker_count=2,
                max_speaker_count=self.max_speakers,
            ),
        )

        blob: Optional[storage.Blob] = None
        gcs_uri: Optional[str] = None

        try:
            # 1. Upload audio bytes to GCS and get gs:// URI
            gcs_uri, blob = await self.upload_audio_to_gcs(audio_bytes)

            # 2. Configure STT using the GCS URI (bypasses 60-second inline audio limit)
            audio = speech.RecognitionAudio(uri=gcs_uri)

            logger.info(f"[STT] Submitting long_running_recognize request for URI: {gcs_uri}...")
            operation = await asyncio.to_thread(self.client.long_running_recognize, config=config, audio=audio)
            
            logger.info("[STT] Processing audio via Google Cloud Speech-to-Text...")
            response = await asyncio.to_thread(operation.result, timeout=600)
            
            logger.info("[STT] Transcription and Diarization completed successfully.")
            return self._parse_response(response)

        except Exception as e:
            logger.error(f"[STT Failed] Error during speech recognition for {gcs_uri}: {e}")
            raise e

        finally:
            # 3. Clean up the temporary blob from GCS
            if blob:
                try:
                    logger.info(f"[GCS Cleanup] Deleting temporary audio blob '{gcs_uri}'...")
                    await asyncio.to_thread(blob.delete)
                    logger.info(f"[GCS Cleanup] Successfully deleted temporary audio blob '{gcs_uri}'.")
                except Exception as e:
                    logger.warning(f"[GCS Cleanup] Failed to delete blob '{gcs_uri}': {e}")

stt_service = STTService()
