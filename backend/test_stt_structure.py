import asyncio
from google.cloud import speech_v1 as speech
from google.protobuf.json_format import MessageToJson

def mock_response():
    # We will just write a script that sends a small audio file to STT and saves the JSON response to inspect it.
    pass
