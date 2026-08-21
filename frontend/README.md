# NEURIS Console

React + Vite frontend for the NEURIS memory intelligence backend.

## Running locally

```bash
npm install
npm run dev            # http://localhost:5173
```

The dev server proxies `/api` and `/health` to `http://localhost:8000`, so the
browser talks to a same-origin API and no CORS configuration is needed.

If the backend runs somewhere else:

```bash
VITE_PROXY_TARGET=http://127.0.0.1:8123 npm run dev
```

You can also point the app at an absolute backend origin at runtime from
**Settings > Connection**; that value is stored in `localStorage` and takes
precedence over the build-time `VITE_API_BASE_URL`.

## Build

```bash
npm run build          # emits dist/
npm run preview        # serves dist/ on :4173 with the same proxy
```

## Routes

| Route        | Purpose                                                      | Endpoints used |
|--------------|--------------------------------------------------------------|----------------|
| `/`          | Assistant - text and voice capture, grounded answers          | `POST /api/v1/conversations/ingest`, `POST /api/v1/conversations/ingest/audio` |
| `/search`    | Read-only graph retrieval                                     | `GET /api/v1/search/rag` |
| `/memories`  | Browse extracted memories                                     | `GET /api/v1/memories` |
| `/analytics` | Counters and live service health                              | `GET /api/v1/analytics/summary`, `GET /api/v1/memories`, `GET /health` |
| `/settings`  | API endpoint, capture mode, language, theme                   | `GET /health` |

## Capture modes

- **Browser** - the Web Speech API transcribes locally (Chrome/Edge only) and
  the text is posted to the ingest endpoint. This is the path the original
  `test_mic.html` tester used.
- **Server** - `MediaRecorder` uploads audio to the STT endpoint, which returns
  a speaker-diarized transcript. This is the only mode that produces speaker
  segments.

## Structure

```
src/
  api/         fetch wrapper, one error shape for every call
  components/
    ui/        design-system primitives (button, card, badge, modal, ...)
    layout/    shell, sidebar, page header, theme toggle
  hooks/       useApi, useHealth, useSpeechRecognition, useAudioRecorder
  lib/         runtime config (localStorage) and formatters
  pages/       one file per route
  styles/      tokens.css -> base.css -> components.css -> app.css
```

`styles/tokens.css` is the single source of truth for colour, type, spacing,
radius, shadow and motion. Light is the base definition; dark overrides only
the tokens that must change, under both `prefers-color-scheme` and an explicit
`[data-theme]` attribute.

## Docker

The image runs the dev server. To add it to the root `docker-compose.yml`:

```yaml
  frontend:
    build: ./frontend
    container_name: neuris-frontend
    ports:
      - "5173:5173"
    environment:
      VITE_PROXY_TARGET: http://backend:8000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - neuris-net
```
