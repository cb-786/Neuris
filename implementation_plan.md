# NEURIS — Finalized Implementation Plan v2

> **All design decisions locked in. STT + Diarization integrated. Ready to build.**

---

## Design Decisions (All 8 Answered + STT)

| # | Question | Decision |
|---|----------|----------|
| 1 | Scope | **Full NEURIS memory intelligence system.** NIC project is reference only — not touched. All new code goes into `/Neuris`. |
| 2 | Authentication | **Skip for now.** Architecture uses dependency injection so auth can be bolted on later with zero refactoring. |
| 3 | Persistent Memory Store | **SQLite** via `aiosqlite` + `SQLAlchemy`. Free, zero subscription, no extra Docker container. |
| 4 | Cache Strategy | **Simple string normalization** (lowercase, strip, collapse whitespace) for Redis cache keys. |
| 5 | Graph Traversal Depth | **2-hop** traversal from anchor nodes during GraphRAG retrieval. |
| 6 | Background Pipeline | **FastAPI `BackgroundTasks`** — lightweight, in-process. |
| 7 | Frontend | **Full rebuild** — NEURIS-branded chat-first interface with sidebar navigation. |
| 8 | Target Directory | **`/home/ch0/Desktop/peace/Neuris/`** — NIC folder is read-only reference. |
| **9** | **STT & Diarization** | **Google Cloud Speech-to-Text V2 (Chirp 3)** with built-in speaker diarization. Dual input: text OR audio. |

---

## Complete Project Structure

```
Neuris/
├── docker-compose.yml                    # Orchestrates Neo4j, Redis, Backend, Frontend, Nginx
├── .env.example                          # Template environment variables
├── .gitignore
├── README.md
│
├── nginx/
│   └── nginx.conf                        # Reverse proxy: /api → backend, / → frontend
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env
│   │
│   ├── data/                             # Runtime data (SQLite DB, uploaded audio)
│   │   └── .gitkeep
│   │
│   ├── scripts/
│   │   └── hydrate_vectors.py            # Batch embedding hydration for graph nodes
│   │
│   └── app/
│       ├── __init__.py
│       ├── main.py                       # FastAPI app, lifespan, middleware stack
│       │
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py                 # Pydantic Settings (env vars incl. GCP project ID)
│       │   └── prompts.py                # All LLM prompt templates
│       │
│       ├── models/
│       │   ├── __init__.py
│       │   ├── graph_models.py           # Node, Edge, GraphResult (Neo4j entities)
│       │   ├── conversation_models.py    # Conversation, Message, Speaker, DiarizedSegment
│       │   └── memory_models.py          # MemoryEntry, Summary, EntityReference
│       │
│       ├── services/
│       │   ├── __init__.py
│       │   ├── llm.py                    # Gemini API wrapper (completions + embeddings)
│       │   ├── cache.py                  # Redis cache with normalized string keys
│       │   ├── neo4j_service.py          # Graph DB operations, 2-hop traversal, HNSW search
│       │   ├── graphrag.py               # Entity extraction → Neo4j → context → LLM synthesis
│       │   ├── stt_service.py            # ★ NEW: Google Cloud STT V2 wrapper (Chirp 3 + diarization)
│       │   ├── audio_pipeline.py         # ★ UPGRADED: Orchestrates STT → diarization → transcript
│       │   ├── context_builder.py        # Structures raw Neo4j results into grounded facts
│       │   ├── memory_store.py           # SQLite persistent memory (conversations, summaries)
│       │   ├── post_processor.py         # Response validation, PII redaction, guardrails
│       │   ├── analytics.py              # Usage metrics, latency tracking, query logging
│       │   └── background_tasks.py       # Async memory update pipeline
│       │
│       ├── api/
│       │   ├── __init__.py
│       │   ├── routes.py                 # All API endpoints (text + audio ingest, search, memory)
│       │   └── deps.py                   # Dependency injection (future auth hook)
│       │
│       └── db/
│           ├── __init__.py
│           ├── database.py               # SQLite/SQLAlchemy async engine + session factory
│           └── tables.py                 # SQLAlchemy table definitions
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx                      # React entry point
        ├── App.jsx                       # Root layout with sidebar + routing
        ├── index.css                     # Global design system (NEURIS branding)
        │
        ├── api/
        │   └── api.js                    # Fetch wrapper for all backend endpoints
        │
        ├── components/
        │   ├── Sidebar.jsx               # Navigation sidebar
        │   ├── ChatInterface.jsx         # Main conversation view (multi-turn)
        │   ├── MessageBubble.jsx         # Individual message rendering
        │   ├── AudioRecorder.jsx         # ★ NEW: Browser mic recording + upload
        │   ├── TranscriptView.jsx        # ★ NEW: Diarized transcript with speaker labels
        │   ├── MemoryBrowser.jsx         # Browse stored memories & entities
        │   ├── GraphExplorer.jsx         # Visualize knowledge graph connections
        │   ├── SettingsPanel.jsx         # System settings & preferences
        │   └── StatusBar.jsx             # Connection status, cache indicators
        │
        └── hooks/
            └── useApi.js                 # Custom hook for API calls with loading/error states
```

---

## Pipeline Block → File Mapping

### Block 1: Input Layer (Dual Mode — Text + Audio)

> **What it does:** Accepts either raw text OR audio input. Audio goes through Google STT + diarization. Both paths converge into the same `TranscribedMessage` schema for downstream processing.

```
┌─────────────────┐     ┌──────────────────┐
│  Text Input      │     │  Audio Input      │
│  (typed message) │     │  (mic / upload)   │
└───────┬─────────┘     └───────┬──────────┘
        │                       │
        │                       ▼
        │               ┌──────────────────┐
        │               │  stt_service.py   │
        │               │  Google Cloud STT │
        │               │  V2 (Chirp 3)    │
        │               │  + Diarization    │
        │               └───────┬──────────┘
        │                       │
        │                       ▼
        │               ┌──────────────────┐
        │               │ audio_pipeline.py │
        │               │ Speaker grouping  │
        │               │ Timestamp mapping │
        │               └───────┬──────────┘
        │                       │
        ▼                       ▼
┌───────────────────────────────────────────┐
│         TranscribedMessage schema          │
│  { segments: [{speaker, text, start, end}] │
│    full_text, speaker_count, source }      │
└───────────────────┬───────────────────────┘
                    │
                    ▼
          (Same pipeline from here)
          Embedding → Cache → GraphRAG → LLM
```

| File | Role |
|------|------|
| `stt_service.py` | **NEW.** Wraps the Google Cloud Speech-to-Text V2 API. Uses the **Chirp 3** model with diarization enabled. Accepts audio bytes → returns `TranscriptionResult` with per-word speaker tags, word-level timestamps, and full transcript. Handles audio format auto-detection. |
| `audio_pipeline.py` | **UPGRADED from stub.** Orchestrator service with two code paths: (1) **Text mode:** wraps raw text into `TranscribedMessage` with `speaker="user"` and current timestamp. (2) **Audio mode:** calls `stt_service.py`, groups words by speaker tag into `DiarizedSegment` objects, assigns speaker labels ("Speaker 1", "Speaker 2", etc.), constructs the full `TranscribedMessage`. |
| `conversation_models.py` | Pydantic models: `TextInput`, `AudioInput`, `DiarizedSegment` (speaker, text, start_time, end_time), `TranscribedMessage` (segments, full_text, speaker_count, source), `TranscriptionResult` |
| `routes.py` | Two ingest endpoints: `POST /api/v1/conversations/ingest` (JSON text body) and `POST /api/v1/conversations/ingest/audio` (multipart file upload) |
| `AudioRecorder.jsx` | **NEW.** Browser component using the `MediaRecorder` API. Records audio from the user's microphone, shows recording state (waveform/timer), and uploads the audio blob to the backend `/ingest/audio` endpoint. Supports WAV and WebM formats. |
| `TranscriptView.jsx` | **NEW.** Renders the diarized transcript with color-coded speaker labels. Each segment shows: speaker name (color-coded), timestamp range, and transcribed text. Expandable/collapsible within the chat interface. |

#### How `stt_service.py` works internally:

```python
# Simplified flow — actual implementation will have error handling, retries, etc.

class STTService:
    def __init__(self):
        self.client = speech_v2.SpeechClient()
        self.project_id = settings.GCP_PROJECT_ID

    async def transcribe(self, audio_bytes: bytes, language: str = "en-US") -> TranscriptionResult:
        """
        Sends audio to Google Cloud STT V2 with Chirp 3 + diarization.
        Returns structured transcript with per-word speaker tags.
        """
        config = cloud_speech.RecognitionConfig(
            auto_decoding_config=cloud_speech.AutoDecodingConfig(),  # auto-detect format
            language_codes=[language],
            model="chirp_3",
            features=cloud_speech.RecognitionFeatures(
                enable_automatic_punctuation=True,
                enable_word_time_offsets=True,
                diarization_config=cloud_speech.SpeakerDiarizationConfig(
                    min_speaker_count=1,
                    max_speaker_count=6,
                ),
            ),
        )

        request = cloud_speech.RecognizeRequest(
            recognizer=f"projects/{self.project_id}/locations/global/recognizers/_",
            config=config,
            content=audio_bytes,
        )

        response = await asyncio.to_thread(self.client.recognize, request=request)
        return self._parse_response(response)
```

#### How `audio_pipeline.py` orchestrates both paths:

```python
class AudioPipeline:

    async def process_text(self, text: str) -> TranscribedMessage:
        """Text mode — wraps raw text, no STT needed."""
        return TranscribedMessage(
            segments=[DiarizedSegment(speaker="user", text=text, start_time=0, end_time=0)],
            full_text=text,
            speaker_count=1,
            source="text",
        )

    async def process_audio(self, audio_bytes: bytes, language: str = "en-US") -> TranscribedMessage:
        """Audio mode — calls Google STT, then groups words into speaker segments."""
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
```

#### Interaction flow — how audio flows through the system:

```
Frontend (AudioRecorder.jsx)
  │  User clicks 🎤, speaks, clicks stop
  │  MediaRecorder captures WebM/WAV blob
  │
  ▼
routes.py  →  POST /api/v1/conversations/ingest/audio
  │  Receives multipart file upload (audio blob)
  │  Validates file size (max 10MB) and format
  │
  ▼
audio_pipeline.py  →  process_audio(audio_bytes)
  │  Calls stt_service.transcribe()
  │  Groups words by speaker into DiarizedSegments
  │  Returns TranscribedMessage
  │
  ▼
routes.py  (continues — same path as text from here)
  │  1. Stores conversation + segments in SQLite (memory_store.py)
  │  2. Sends full_text to the GraphRAG pipeline (graphrag.py)
  │  3. Kicks off background memory update (background_tasks.py)
  │  4. Returns AI response + transcript to frontend
  │
  ▼
Frontend (ChatInterface.jsx)
  │  Renders AI response in MessageBubble
  │  Shows expandable TranscriptView with speaker-labeled segments
```

---

### Block 2: Security & Access (Deferred, Architected)

| File | Role |
|------|------|
| `deps.py` | Contains a `get_current_user()` dependency that currently returns a default user. When auth is needed: add JWT validation here. Every route uses `Depends(get_current_user)`, so adding auth is a single-file change. |
| `main.py` | CORS middleware configured. Rate limiting can be added as middleware later. |

---

### Block 3.1: Audio Understanding Pipeline (Fully Implemented)

> **No longer a stub.** This is now a real pipeline using Google Cloud STT V2.

| File | Role | Interacts With |
|------|------|----------------|
| `stt_service.py` | **Core STT wrapper.** Handles Google Cloud API calls, audio format detection, Chirp 3 model selection, diarization config. Singleton service initialized at app startup. | `config.py` (for GCP credentials), `conversation_models.py` (returns `TranscriptionResult`) |
| `audio_pipeline.py` | **Orchestrator.** Routes text vs audio input. For audio: calls `stt_service`, groups diarized words into speaker segments, applies timestamp mapping. | `stt_service.py` (STT calls), `conversation_models.py` (produces `TranscribedMessage`) |
| `conversation_models.py` | **Schemas.** `DiarizedSegment`, `TranscribedMessage`, `TranscriptionResult`, `DiarizedWord` | Used by `audio_pipeline.py`, `routes.py`, `memory_store.py` |
| `routes.py` | **Endpoints.** `POST /ingest` (text) and `POST /ingest/audio` (file upload). Both call `audio_pipeline` then feed into the same downstream pipeline. | `audio_pipeline.py`, `graphrag.py`, `background_tasks.py` |

---

### Block 3.2: Embedding & Cache Layer

| File | Role |
|------|------|
| `llm.py` | `generate_embedding(text) → list[float]` using `gemini-embedding-2` (768-dim). |
| `cache.py` | Redis `get()`/`set()` with **normalized keys**: `lowercase → strip → collapse whitespace → prefix`. TTL-based expiry. |
| `routes.py` | Cache check first in `/search/rag`. Hit → instant return. Miss → full pipeline. |

---

### Block 3.3: Knowledge Retrieval & GraphRAG Pipeline

| File | Role |
|------|------|
| `neo4j_service.py` | HNSW vector search + **2-hop Cypher traversal**. |
| `context_builder.py` | Raw Neo4j records → clean entity-relation-entity triples for LLM prompt. |
| `graphrag.py` | Orchestrates: embed → vector search → 2-hop → context build → prompt → LLM. |
| `prompts.py` | System prompts for entity extraction, memory-aware RAG synthesis, conversation summarization. |

---

### Block 3.4: Reasoning & Response Generation

| File | Role |
|------|------|
| `llm.py` | Gemini API calls with JSON mode, system instructions, retry + exponential backoff. |
| `post_processor.py` | Validates LLM JSON against Pydantic schemas. PII redaction. Hallucination guardrails. |

---

### Block 4.1: Knowledge Graph (Neo4j)

| File | Role |
|------|------|
| `neo4j_service.py` | Node types: `Entity`, `Person`, `Event`, `Topic`, `Conversation`, `Memory`. Relationships: `MENTIONED_IN`, `DISCUSSED_WITH`, `RELATED_TO`, `OCCURRED_AT`, `ABOUT`, `PART_OF`. HNSW vector index on Entity nodes. |
| `graph_models.py` | Pydantic models for all node/edge types and query results. |

---

### Block 4.2: Persistent Memory Store (SQLite)

| File | Role |
|------|------|
| `database.py` | SQLAlchemy async engine via `aiosqlite`. Creates `neuris.db`. |
| `tables.py` | Tables: `conversations`, `messages` (now includes `speaker` and `source` columns for diarized data), `memories`, `analytics_events` |
| `memory_store.py` | CRUD for conversations, messages (with speaker attribution), memories, entity links. |
| `memory_models.py` | Pydantic schemas: `MemoryEntry`, `ConversationSummary`, `EntityReference` |

---

### Block 4.3: Analytics & Observability

| File | Role |
|------|------|
| `analytics.py` | Logs every request: query text, latency_ms, cache_hit, tokens_used, input_source (`text` or `audio`), stt_duration_ms (if audio), pipeline_stage, error. |
| `routes.py` | `GET /api/v1/analytics/summary` — aggregated stats. |

---

### Block 5: User Interface (Full Rebuild + Audio)

| Component | Role |
|-----------|------|
| `Sidebar.jsx` | NEURIS logo, nav items (Chat, Memories, Graph Explorer, Settings), connection status |
| `ChatInterface.jsx` | Multi-turn conversation. Text input + 🎤 mic button at bottom. Shows AI responses, cache badges, latency. |
| `MessageBubble.jsx` | Renders messages with avatar, timestamp, typing animation |
| `AudioRecorder.jsx` | **★ NEW.** Mic button → MediaRecorder API → records WebM audio → shows recording timer/waveform → uploads blob to `/ingest/audio`. States: idle → recording → uploading → done. |
| `TranscriptView.jsx` | **★ NEW.** Renders diarized transcript inside a message bubble. Speaker labels are color-coded (Speaker 1 = blue, Speaker 2 = green, etc.). Each segment shows timestamp range + text. Collapsible accordion. |
| `MemoryBrowser.jsx` | Card-based grid of memories. Search/filter. Expand to see entities + graph neighborhood. |
| `GraphExplorer.jsx` | Entity/relationship visualization. |
| `SettingsPanel.jsx` | Memory preferences, API status, cache controls, STT language selector. |
| `StatusBar.jsx` | Neo4j, Redis, STT API status indicators. Last query latency. Cache hit rate. |

**Design language:** Dark theme, glassmorphism, NEURIS purple/blue gradient, smooth transitions, Inter/Outfit fonts.

---

### Block 6: Continuous Memory Update Pipeline (Async)

| File | Role |
|------|------|
| `background_tasks.py` | After every conversation turn (text or audio): (1) Embed the message → (2) Extract entities & relationships → (3) MERGE into Neo4j → (4) Store conversation + diarized segments in SQLite → (5) Invalidate stale cache entries. |

---

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `neo4j` | `neo4j:5.20-community` | 7474, 7687 | Knowledge graph + vector index |
| `redis` | `redis:7.2-alpine` | 6379 | Response cache |
| `backend` | Custom (Python 3.11) | 8000 | FastAPI + STT processing |
| `frontend` | Custom (Node 20) | 5173 | React + Vite dev server |
| `nginx` | `nginx:1.25-alpine` | 80 | Reverse proxy |
| `vector-init` | Reuses backend image | — | One-shot embedding hydration |

---

## Verification Plan

### Automated
```bash
# 1. Health check
curl http://localhost/api/health

# 2. Ingest a text conversation
curl -X POST http://localhost/api/v1/conversations/ingest \
  -H "Content-Type: application/json" \
  -d '{"text": "I had a meeting with Sarah about the Q3 marketing budget"}'

# 3. Ingest audio (simulate with a WAV file)
curl -X POST http://localhost/api/v1/conversations/ingest/audio \
  -F "audio=@test_audio.wav" \
  -F "language=en-US"

# 4. Query the memory graph
curl "http://localhost/api/v1/search/rag?q=marketing%20budget"

# 5. Check stored memories
curl http://localhost/api/v1/memories

# 6. Verify cache hit on repeat query
curl "http://localhost/api/v1/search/rag?q=marketing%20budget"
# Should return "cached": true

# 7. Check analytics
curl http://localhost/api/v1/analytics/summary
```

### Manual
- Open `http://localhost` → NEURIS chat interface loads
- Type a message → AI responds
- Click 🎤 → record audio → see diarized transcript appear → AI responds
- Memories tab → verify conversations stored with speaker attribution
- Settings → verify STT status indicator

---

## Dependencies (Full Cost Breakdown)

### Backend (`requirements.txt`)
| Package | Purpose | Cost |
|---------|---------|------|
| `fastapi` | Web framework | Free |
| `uvicorn[standard]` | ASGI server | Free |
| `pydantic` / `pydantic-settings` | Data validation & config | Free |
| `google-genai` | Gemini API (LLM + embeddings) | Free tier: 15 RPM / 1M tokens/day |
| `google-cloud-speech` | **★ STT + Diarization** | **Free tier: 60 min/month** |
| `neo4j` | Graph database driver | Free (Community Edition) |
| `redis` | Cache client | Free |
| `aiosqlite` | Async SQLite driver | Free |
| `sqlalchemy[asyncio]` | ORM / query builder | Free |
| `httpx` | Async HTTP client | Free |
| `python-dotenv` | Env file loading | Free |
| `python-multipart` | File upload parsing (for audio) | Free |

### Frontend (`package.json`)
| Package | Purpose | Cost |
|---------|---------|------|
| `react` / `react-dom` | UI framework | Free |
| `vite` | Build tool | Free |
| `lucide-react` | Icon library | Free |
| `react-router-dom` | Client-side routing | Free |

### Cost Summary

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| **Gemini API** | 15 RPM, 1M tokens/day | Pay-as-you-go |
| **Google Cloud STT** | **60 minutes/month** | **$0.016/minute** (diarization included, no surcharge) |
| Neo4j Community | Unlimited | Free forever |
| Redis | Unlimited | Free forever |
| SQLite | Unlimited | Free forever |
| All pip/npm packages | Unlimited | Free forever |

> [!IMPORTANT]
> **Google Cloud STT requires a GCP project with billing enabled** (even to use the free tier). You won't be charged unless you exceed 60 minutes/month, but a billing account must be linked. New GCP accounts get $300 in free credits.

### New Environment Variables (added to `.env`)
```env
# ── Google Cloud STT ──────────────────────────────────────────────────────────
GCP_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/gcp-service-account.json
STT_LANGUAGE_CODE=en-US
STT_MAX_SPEAKERS=6
STT_MODEL=chirp_3
```

> [!NOTE]
> The `GOOGLE_APPLICATION_CREDENTIALS` points to a GCP service account JSON key file. This file must be volume-mounted into the Docker container. We'll add a `credentials/` directory to the project (gitignored) and a volume mount in `docker-compose.yml`.
