from pydantic import BaseModel
from typing import List, Optional

class TextInput(BaseModel):
    text: str

class Speaker(BaseModel):
    id: str
    name: str

class DiarizedWord(BaseModel):
    word: str
    start_time: float
    end_time: float
    speaker_tag: int

class DiarizedSegment(BaseModel):
    speaker: str
    text: str
    start_time: float
    end_time: float

class TranscriptionResult(BaseModel):
    full_transcript: str
    words: List[DiarizedWord]
    speaker_count: int

class TranscribedMessage(BaseModel):
    segments: List[DiarizedSegment]
    full_text: str
    speaker_count: int
    source: str # 'text' or 'audio'
