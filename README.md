# NEURIS

AI memory intelligence platform for capturing conversations, extracting graph-based memory, and retrieving grounded insights from voice and text inputs.

## Overview

NEURIS turns spoken or written interactions into structured memory objects, connects them in a knowledge graph, and makes them retrievable through a modern web interface. The system combines:

- Voice capture and transcription
- Speaker-aware diarization and transcript processing
- Graph memory extraction and relationship linking
- Retrieval-augmented generation for grounded answers
- Analytics and timeline-based memory exploration

## Architecture

NEURIS is composed of a FastAPI backend, a React frontend, Neo4j for graph storage, Redis for caching, and cloud-based AI services for LLM and speech processing.

- Backend: FastAPI + SQLAlchemy + Pydantic
- Frontend: React + Vite
- Graph DB: Neo4j
- Cache: Redis
- AI services: Google Gemini + Google Cloud Speech
- Container orchestration: Docker Compose

## Features

- Real-time or uploaded audio capture
- Speech-to-text with diarization support
- Structured memory extraction for people, events, facts, and context
- Graph-based retrieval and relationship exploration
- Memory timeline and analytics views
- Secure configuration using environment variables and credentials files

## Repository structure

```text
.
├── backend/                 # FastAPI application and services
│   ├── app/
│   ├── scripts/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # React frontend
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── nginx/                   # Reverse proxy config
├── docker-compose.yml       # Local orchestration for Neo4j, Redis, backend, frontend
├── credentials/             # Local Google credentials (not committed)
├── .gitignore               # Security-sensitive files excluded from Git
├── README.md                # Project overview and setup instructions
├── LICENSE                  # Project license
└── implementation_plan.md   # Project planning notes
```

## Prerequisites

Before running the project locally, make sure you have:

- Docker and Docker Compose
- Python 3.11+
- Node.js 18+
- npm
- A Google Cloud project with Speech-to-Text enabled
- A Gemini API key
- Neo4j access credentials if you are running outside Docker

## Quick start

### 1) Clone the repository

```bash
git clone https://github.com/cb-786/Neuris.git
cd Neuris
```

### 2) Configure environment variables

Create a backend environment file:

```bash
cp backend/.env.example backend/.env
```

Then update the values in `backend/.env` with your own settings, including:

- `GEMINI_API_KEY`
- `GCP_PROJECT_ID`
- `NEO4J_PASSWORD`
- any other required runtime credentials

Also place your Google Cloud service account JSON file in:

```text
./credentials/gcp-service-account.json
```

### 3) Start the stack

```bash
docker compose up --build
```

This will start:

- Neo4j on `http://localhost:7474`
- Redis on `localhost:6379`
- Backend API on `http://localhost:8000`
- Frontend on `http://localhost`

### 4) Open the app

- Web app: `http://localhost`
- API docs: `http://localhost:8000/api/docs`
- Neo4j browser: `http://localhost:7474`

## Local development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment notes

The project intentionally keeps secrets and credentials out of source control. The following files should remain local-only:

- `backend/.env`
- `credentials/*.json`
- any generated database or state directories

## Security and privacy

NEURIS is designed for memory capture and contextual retrieval. When deploying, ensure that:

- API keys are managed through a secure environment system
- speech recordings and transcripts are protected appropriately
- access to the app is restricted to trusted users
- your Cloud credentials are not committed to Git

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. Please open an issue or submit a pull request with a focused change and a clear description of the problem being solved.

## Roadmap

Planned improvements include:

- improved memory ranking and summarization
- multi-user memory isolation
- stronger privacy controls and retention policies
- deeper graph analytics and timeline visualization
- deployment automation for production environments
