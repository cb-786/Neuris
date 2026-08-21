import asyncio
from google.cloud import speech_v1 as speech
from google.oauth2 import service_account
from google.cloud import storage
import os

async def main():
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "/home/ch0/Desktop/peace/Neuris/backend/gcp-credentials.json")
    if not os.path.exists(cred_path):
        print("No creds")
        return
    
    creds = service_account.Credentials.from_service_account_file(cred_path)
    client = speech.SpeechClient(credentials=creds)
    
    # We can just fetch an existing file from the bucket or use a public URI
    # Let's see what is in the bucket
    storage_client = storage.Client(credentials=creds, project=creds.project_id)
    bucket = storage_client.bucket("anubhav0101neuris")
    blobs = list(bucket.list_blobs(max_results=1))
    if not blobs:
        print("No blobs in bucket")
        return
    
    gcs_uri = f"gs://anubhav0101neuris/{blobs[0].name}"
    print("Testing with", gcs_uri)
    
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        language_code="en-US",
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True,
        diarization_config=speech.SpeakerDiarizationConfig(
            enable_speaker_diarization=True,
            min_speaker_count=2,
            max_speaker_count=5,
        ),
    )
    audio = speech.RecognitionAudio(uri=gcs_uri)
    operation = client.long_running_recognize(config=config, audio=audio)
    response = operation.result(timeout=600)
    
    print(f"Number of results: {len(response.results)}")
    for i, r in enumerate(response.results):
        alt = r.alternatives[0] if r.alternatives else None
        if alt:
            has_transcript = bool(alt.transcript)
            word_count = len(alt.words)
            tags = set(getattr(w, 'speaker_tag', 0) for w in alt.words)
            print(f"Result {i}: transcript={has_transcript}, words={word_count}, tags={tags}")
            if word_count > 0:
                w = alt.words[-1]
                print(f"  Last word start_time type: {type(w.start_time)}")
                try:
                    print(f"  Last word start_time: {w.start_time.total_seconds()}")
                except Exception as e:
                    print(f"  Last word start_time error: {e}")
                    
asyncio.run(main())
