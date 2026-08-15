# NEURIS Pipeline → GovIntel.AI: Full Analysis & Gap Mapping

## 1. What Your Project Already Has (Existing Tech Stack)

| Layer | Technology | File(s) | Status |
|-------|-----------|---------|--------|
| **Web Framework** | FastAPI (async) | [`main.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/main.py) | ✅ Running |
| **Knowledge Graph** | Neo4j 5.20 + HNSW Vector Index | [`neo4j_service.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/neo4j_service.py) | ✅ Running |
| **Cache Layer** | Redis 7.2-alpine | [`cache.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/cache.py) | ✅ Running |
| **LLM** | Gemini 2.5 Flash (text + embeddings) | [`llm.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py) | ✅ Running |
| **GraphRAG** | Entity extraction → Neo4j → 1-hop traversal → LLM synthesis | [`graphrag.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/graphrag.py) | ✅ Running |
| **Embeddings** | `gemini-embedding-2` (768-dim) | [`llm.py` L89-101](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py#L89-L101) | ✅ Running |
| **Frontend** | React 18 + Vite | [`App.jsx`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/frontend/src/App.jsx) | ✅ Running |
| **Reverse Proxy** | Nginx 1.25 | [`nginx.conf`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/nginx/nginx.conf) | ✅ Running |
| **Orchestration** | Docker Compose | [`docker-compose.yml`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/docker-compose.yml) | ✅ Running |
| **Data Pipeline** | CSV parsing → LLM entity extraction → Neo4j MERGE | [`data_parser.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/core/data_parser.py), [`prompts.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/core/prompts.py) | ✅ Running |
| **Vector Hydration** | Batch embedding script | [`hydrate_vectors.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/scripts/hydrate_vectors.py) | ✅ Running |

---

## 2. Pipeline Block-by-Block Mapping

Below is every numbered block from the NEURIS architecture diagram, mapped to what exists and what's missing.

---

### Block 1: WEARABLE DEVICE (EDGE)
**Pipeline components:** ESP32-S3, dual MEMS microphones, audio buffer, VAD, secure element (ATECC608A), battery/power mgmt, RGB LED, haptic motor

**What exists in your project:** ❌ Nothing — your input today is typed text via the React frontend.

**What needs to happen (text-input simulation):**
- Instead of a hardware audio capture path, we create a **text input endpoint** that simulates what the wearable would send after STT processing
- This means: the API receives raw text (as if it already went through Speech-to-Text), skipping the entire hardware + audio layer
- We may want a "conversation intake" endpoint: `POST /api/v1/conversations/ingest` that accepts `{ "text": "...", "speaker": "user", "timestamp": "..." }`

---

### Block 2: SECURE COMMUNICATION & ACCESS
**Pipeline components:** TLS 1.3, OAuth 2.0/JWT, API keys, API gateway (load balancing & rate limiting), retry & backoff, audit & access logging

**What exists:**
- ✅ API key auth for Gemini: [`config.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/core/config.py#L16) — `GEMINI_API_KEY`
- ✅ CORS middleware: [`main.py` L48-54](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/main.py#L48-L54)
- ✅ Nginx reverse proxy: [`nginx.conf`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/nginx/nginx.conf)
- ❌ No JWT / OAuth 2.0 user authentication
- ❌ No rate limiting (beyond what Nginx provides by default)
- ❌ No audit/access logging service
- ❌ No retry & backoff mechanism on API calls

**What needs to change:**
- Add a JWT auth middleware or API key system in FastAPI
- Add rate limiting middleware (e.g., `slowapi` or custom)
- Add structured audit logging for every API call
- Add retry logic with exponential backoff in [`llm.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py) for Gemini calls

---

### Block 3.1: AUDIO UNDERSTANDING PIPELINE
**Pipeline components:** Speech-to-Text (OpenAI Whisper / Azure), Speaker Diarization, Speaker Recognition

**What exists:** ❌ Nothing — currently text-only input

**What needs to happen (text-input mode):**
- Since we're simulating without hardware, this entire block is **bypassed**
- The text input directly becomes the "Transcribed Text with Speaker Labels & Timestamps"
- We just need a model/schema that represents the output of this block: `{ "transcribed_text": "...", "speaker": "user", "timestamp": "..." }`
- Future-proofing: create a `services/audio_pipeline.py` with a stub/mock class that accepts text and passes it through unchanged

---

### Block 3.2: EMBEDDING & CACHE LAYER
**Pipeline components:** Embedding generation (text/query/context), Redis semantic cache (cosine similarity + response cache), cache hit/miss logic

**What exists:**
- ✅ Embedding generation: [`llm.py` → `generate_embedding()`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py#L89-L101) — uses `gemini-embedding-2` (768-dim)
- ✅ Redis response cache: [`cache.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/cache.py) — exact-key `get()`/`set()` with TTL
- ✅ Cache hit/miss flow in RAG route: [`routes.py` L278-337](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/api/routes.py#L278-L337)
- ⚠️ **Partial:** Your Redis cache does **exact string matching** on the query key (`rag_search:making clothes`). The pipeline diagram shows **approximate cosine similarity** matching in the cache (semantic cache), not just exact-key lookup.

**What needs to change:**
- Upgrade [`cache.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/cache.py) to support **semantic caching**: store the query embedding alongside the response, and on cache check, compute cosine similarity against stored embeddings to find near-matches (threshold ~0.95)
- This prevents near-duplicate queries ("making clothes" vs "cloth making") from hitting the full pipeline

---

### Block 3.3: KNOWLEDGE RETRIEVAL & GRAPHRAG PIPELINE
**Pipeline components:** Neo4j HNSW vector search (anchor node retrieval), GraphRAG subgraph expansion (multi-hop traversal), grounded context construction (extracted facts, metadata, relations), RAG prompt construction (query + context + metadata + system prompt)

**What exists:**
- ✅ Neo4j HNSW vector search: [`neo4j_service.py` → `search_semantic_with_context()`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/neo4j_service.py#L317-L350) — `db.index.vector.queryNodes('activity_embeddings', ...)`
- ✅ 1-hop graph traversal in the same Cypher query
- ✅ RAG prompt construction: [`llm.py` → `synthesize_graphrag_context()`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py#L103-L148) — builds system prompt + user prompt with context
- ⚠️ **Partial:** Only does 1-hop traversal. Pipeline diagram says "Multi-hop Traversal"
- ⚠️ **Partial:** No explicit "Grounded Context Construction" step — the raw Neo4j JSON is dumped into the prompt. The pipeline suggests a more structured intermediary step that extracts facts, metadata, and relations into a clean format before prompt construction

**What needs to change:**
- Extend the Cypher query in [`neo4j_service.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/neo4j_service.py) to support configurable multi-hop traversal (2-3 hops)
- Create a new `services/context_builder.py` that takes raw Neo4j results and structures them into grounded facts (entity-relation-entity triples, metadata, etc.) before passing to the LLM
- Enhance the RAG prompt in [`llm.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py) to use this structured context format

---

### Block 3.4: REASONING & RESPONSE GENERATION
**Pipeline components:** Cloud LLM Service (OpenAI / Claude / Gemini), structured memory response (JSON/schema-based output), post-processing & validation (guardrails, formatting, PII redaction)

**What exists:**
- ✅ Gemini LLM: [`llm.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py)
- ✅ JSON-forced output via system prompt + `response_mime_type="application/json"`
- ⚠️ **Partial:** Basic JSON cleanup (`removeprefix("```json")`) but no real post-processing/validation/guardrails
- ❌ No PII redaction
- ❌ No response schema validation (Pydantic validates the *input* models, but the LLM synthesis response is just `json.loads()` with a try/except)

**What needs to change:**
- Add a `services/post_processor.py` for response validation against a Pydantic schema
- Add PII redaction logic (regex-based for names, emails, phone numbers, etc.)
- Add guardrails for hallucination detection (e.g., verify NIC codes mentioned in the response actually exist in the graph)

---

### Block 4.1: KNOWLEDGE GRAPH (NEO4J)
**Pipeline components:** Neo4j KG (Nodes, Relationships, Properties), HNSW Vector Index

**What exists:**
- ✅ **Fully implemented.** Neo4j with Activity, Product, RawMaterial, Sector, Process nodes
- ✅ HNSW vector index on Activity nodes (`activity_embeddings`, 768-dim, cosine)
- ✅ Constraint-based schema: [`neo4j_service.py` L67-92](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/neo4j_service.py#L67-L92)

**What needs to change:**
- Extend the node types to support NEURIS-specific entities: `Conversation`, `Memory`, `Entity`, `Person`, `Event`, `Topic`
- Add new relationship types: `MENTIONED_IN`, `DISCUSSED_WITH`, `OCCURRED_AT`, `ABOUT`
- The existing NIC-specific nodes can coexist or be refactored depending on your goal

---

### Block 4.2: PERSISTENT MEMORY STORE
**Pipeline components:** Conversations, Summaries, Entities, Referenced Embedding IDs. Backed by SQLite / PostgreSQL.

**What exists:** ❌ Nothing — no persistent memory store. Currently stateless per-request.

**What needs to change:**
- Add SQLite (or PostgreSQL) as a new service
- Create a `services/memory_store.py` with tables for: `conversations`, `summaries`, `entities`, `embedding_references`
- Add a new Docker service in [`docker-compose.yml`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/docker-compose.yml) (if PostgreSQL)
- Wire it into the ingestion and query pipelines

---

### Block 4.3: ANALYTICS & OBSERVABILITY
**Pipeline components:** Analytics database (usage metrics, latency, user behavior, quality), logging, monitoring, alerting

**What exists:**
- ✅ Basic Python logging (`logging.getLogger()`) used across all services
- ✅ Health check endpoint: [`main.py` L59-65](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/main.py#L59-L65)
- ✅ Status endpoint: [`routes.py` L28-46](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/api/routes.py#L28-L46)
- ❌ No analytics database
- ❌ No latency tracking / user behavior tracking
- ❌ No alerting system

**What needs to change:**
- Create a `services/analytics.py` that logs every request with: query, latency, cache_hit, token_count, result_quality_score
- Could use SQLite for analytics storage initially
- Add middleware to FastAPI that auto-tracks request latency

---

### Block 5: USER INTERFACE & DELIVERY
**Pipeline components:** Response delivery (mobile/web), user query input (text/voice), settings & controls (privacy, memory, notifications, device management)

**What exists:**
- ✅ React frontend with search + ingestion: [`App.jsx`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/frontend/src/App.jsx)
- ✅ API wrapper: [`api.js`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/frontend/src/api/api.js)
- ❌ No settings/controls panel
- ❌ No conversation history UI
- ❌ No memory management UI

**What needs to change:**
- Add a "Conversations" tab/view showing conversation history
- Add a "Settings" panel for memory preferences, privacy controls
- Adapt the search interface to support multi-turn conversation (not just single queries)

---

### Block 6: CONTINUOUS MEMORY UPDATE PIPELINE (ASYNC)
**Pipeline components:** New conversation/event → Embedding generation → Entity & relationship extraction → Knowledge graph update (Insert/Merge in Neo4j) → Semantic cache refresh → Index optimization

**What exists:**
- ✅ Embedding generation: [`llm.py` → `generate_embedding()`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py#L89-L101)
- ✅ Entity & relationship extraction: [`graphrag.py` → `extract()`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/graphrag.py#L59-L75)
- ✅ KG update (MERGE): [`neo4j_service.py` → `write_graph_result()`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/neo4j_service.py#L166-L191)
- ✅ Vector hydration (batch, async): [`hydrate_vectors.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/scripts/hydrate_vectors.py)
- ❌ **Not async/event-driven** — currently synchronous, triggered by manual API calls
- ❌ No semantic cache refresh step
- ❌ No index optimization step

**What needs to change:**
- Add a background task runner (e.g., FastAPI `BackgroundTasks`, or Celery, or `asyncio.create_task`)
- After every conversation, trigger the async pipeline: embed → extract entities → MERGE into Neo4j → invalidate/refresh relevant cache entries
- Add periodic index optimization (could be a cron job in Docker)

---

## 3. Summary: Files That Need to Change

### Existing Files to Modify

| File | Changes Required |
|------|-----------------|
| [`config.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/core/config.py) | Add SQLite/PostgreSQL URI, JWT secret, rate limit settings, audio pipeline config vars |
| [`routes.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/api/routes.py) | Add conversation endpoints (`POST /conversations/ingest`, `GET /conversations/history`), settings endpoints, auth middleware |
| [`llm.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/llm.py) | Add retry/backoff logic, enhanced RAG prompt with structured context, multi-model support |
| [`cache.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/cache.py) | Upgrade to semantic caching (cosine similarity on stored embeddings) |
| [`neo4j_service.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/neo4j_service.py) | Add multi-hop traversal, new node types (Conversation, Memory, Entity, Person, Event, Topic), new relationship types, new indexes/constraints |
| [`graphrag.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/services/graphrag.py) | Add conversation-based entity extraction (not just NIC codes), memory-aware extraction |
| [`graph_models.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/models/graph_models.py) | Add new node labels (Conversation, Memory, Entity, Person, Event, Topic), new edge types |
| [`prompts.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/core/prompts.py) | Add conversation entity extraction prompts, memory synthesis prompts |
| [`main.py`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/app/main.py) | Add auth middleware, analytics middleware, memory store lifecycle |
| [`docker-compose.yml`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/docker-compose.yml) | Add PostgreSQL/SQLite service, background worker service |
| [`requirements.txt`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/requirements.txt) | Add `pyjwt`, `slowapi`, `sqlalchemy`/`aiosqlite`, `numpy` (for cosine similarity) |
| [`App.jsx`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/frontend/src/App.jsx) | Add conversation UI, settings panel, memory management, multi-turn chat interface |
| [`.env`](file:///home/ch0/Desktop/peace/NIC-code-classification/graphrag-enterprise/backend/.env) | Add JWT_SECRET, DATABASE_URL, new config vars |

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/app/services/audio_pipeline.py` | Stub/mock for Block 3.1 — accepts text, wraps it in the "transcribed text" schema. Future: integrate Whisper/Azure STT |
| `backend/app/services/context_builder.py` | Block 3.3 — takes raw Neo4j graph results, structures them into grounded facts (entity-relation-entity triples) for the LLM prompt |
| `backend/app/services/post_processor.py` | Block 3.4 — validates LLM responses against schema, PII redaction, hallucination detection |
| `backend/app/services/memory_store.py` | Block 4.2 — SQLite/PostgreSQL-backed persistent memory (conversations, summaries, entities) |
| `backend/app/services/analytics.py` | Block 4.3 — tracks usage metrics, latency, cache hit rates, query quality |
| `backend/app/services/auth.py` | Block 2 — JWT creation/validation, API key management |
| `backend/app/services/background_tasks.py` | Block 6 — async pipeline for continuous memory updates after each conversation |
| `backend/app/models/conversation_models.py` | Pydantic schemas for conversations, messages, memories |
| `backend/app/models/memory_models.py` | Pydantic schemas for persistent memory entries |
| `backend/app/core/memory_prompts.py` | Prompts for conversation entity extraction and memory summarization |
| `backend/app/middleware/auth_middleware.py` | FastAPI middleware for JWT/API key validation |
| `backend/app/middleware/analytics_middleware.py` | FastAPI middleware for auto-tracking request metrics |
| `frontend/src/components/ConversationView.jsx` | Multi-turn chat interface component |
| `frontend/src/components/SettingsPanel.jsx` | Settings & controls UI |
| `frontend/src/components/MemoryManager.jsx` | Memory browsing/management UI |

---

## 4. Questions Before Implementation

> [!IMPORTANT]
> I need your input on these before I generate any code.

### Q1: Scope — Full NEURIS or NIC-focused?
The pipeline is clearly designed for a **personal memory assistant** (wearable → conversations → memory graph). Your existing project is an **NIC code classifier**. These are fundamentally different domains:
- **Option A:** Transform GovIntel.AI into a full NEURIS memory system, repurposing the GraphRAG infrastructure but pivoting away from NIC classification
- **Option B:** Keep NIC classification as the primary use case, but layer the NEURIS pipeline architecture on top (conversations about NIC codes get stored as memories, building a "knowledge base" around industrial classification queries)
- **Option C:** Something else?

### Q2: Authentication — How important?
The pipeline shows OAuth 2.0 / JWT. For a demo/prototype:
- Do you want real JWT-based user authentication with login/register?
- Or is a simple API key system sufficient?
- Or skip auth entirely for now?

### Q3: Persistent Memory Store — SQLite or PostgreSQL?
- **SQLite:** Zero config, no extra Docker container, good for demo
- **PostgreSQL:** Production-ready, needs a Docker container, more setup
- Which do you prefer?

### Q4: Semantic Cache — How sophisticated?
Your current Redis cache does exact string matching. The pipeline shows cosine similarity caching:
- **Option A:** Simple — just normalize the query string (lowercase, strip, remove stop words) before keying
- **Option B:** Full semantic — store embeddings in Redis and do cosine similarity on cache check (requires `numpy` or a Redis vector module like `redis-stack`)
- Which level?

### Q5: Multi-hop Traversal — How many hops?
Currently 1-hop. The pipeline says "multi-hop":
- 2-hop is safe and fast
- 3-hop can get noisy and slow on a large graph
- How deep should the traversal go?

### Q6: Background Pipeline — What runner?
For the async continuous memory update pipeline (Block 6):
- **Option A:** FastAPI `BackgroundTasks` (simple, in-process)
- **Option B:** Celery + Redis broker (production-grade, separate worker)
- **Option C:** `asyncio.create_task()` (lightweight, no extra deps)
- Which approach?

### Q7: Frontend — Rebuild or Extend?
- **Option A:** Keep the existing 2-tab layout (Search + Ingestion) and add new tabs (Conversations, Settings)
- **Option B:** Rebuild the frontend as a chat-first interface with sidebar navigation
- Which direction?

### Q8: The Neuris Repo
The `Neuris` workspace directory is empty (just a `.git` folder). Is this supposed to be a separate project, or should all the NEURIS pipeline work go into the existing NIC classification project?
