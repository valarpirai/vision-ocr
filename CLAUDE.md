# CLAUDE.md — Vision OCR

Vision OCR is a full-stack web app for uploading documents, extracting text via the dots.ocr AI model, and searching document content via RAG (ChromaDB + Ollama).

## Stack

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy 2, SQLite (dev) / PostgreSQL (prod)
- **Worker**: 3 parallel instances, each polls DB with `SELECT FOR UPDATE SKIP LOCKED`, calls Ollama minicpm-v for OCR, then indexes into ChromaDB
- **RAG**: ChromaDB (vector store), Ollama `nomic-embed-text` (embeddings), Ollama `llama3.2` (LLM)
- **Frontend**: React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7, Axios
- **Package managers**: `uv` for Python, `pnpm` for Node

## Directory Structure

```
vision/
├── CLAUDE.md                         # This file
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app, router registration, CORS
│   │   ├── config.py                 # All settings via pydantic-settings
│   │   ├── database.py               # SQLAlchemy engine, SessionLocal, get_db
│   │   ├── models.py                 # All ORM models (Upload, OCRResult, Conversation, ConversationMessage)
│   │   ├── schemas.py                # Pydantic request/response schemas for upload API
│   │   ├── api/
│   │   │   ├── upload.py             # Upload CRUD endpoints
│   │   │   └── rag.py                # Conversation + RAG search endpoints
│   │   └── rag/
│   │       ├── chroma_client.py      # ChromaDB singleton client and collection
│   │       ├── embedder.py           # Ollama nomic-embed-text embedding
│   │       ├── indexer.py            # Index/delete OCR pages in ChromaDB
│   │       ├── retriever.py          # Semantic search with optional upload filter
│   │       └── llm.py                # Ollama llama3.2 answer generation
│   ├── worker.py                     # OCR worker loop: poll → process → index
│   └── pyproject.toml                # Python dependencies (uv)
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Router: /, /upload, /history, /search
│   │   ├── api/client.ts             # All Axios API calls
│   │   ├── types/index.ts            # All TypeScript interfaces
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── search/               # RAG search sub-components
│   │   │       ├── ConversationSidebar.tsx
│   │   │       ├── DocumentFilter.tsx
│   │   │       ├── MessageBubble.tsx
│   │   │       └── ChatInput.tsx
│   │   └── pages/
│   │       ├── WelcomePage.tsx
│   │       ├── UploadPage.tsx
│   │       ├── HistoryPage.tsx
│   │       └── SearchPage.tsx        # RAG search UI
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── QUICKSTART.md
│   └── DOTS_OCR_SETUP.md
├── ecosystem.config.js               # PM2 config for local dev
├── docker-compose.yml                # Production containers
└── start.sh                          # Local startup script
```

## Development Commands

### Start everything (local)
> **Note**: `ecosystem.config.js` has hardcoded absolute paths for `uv` and `node` binaries
> (`/Users/valarpirai.annadurai/...`). Update those paths if running on a different machine.

```bash
./start.sh          # checks deps, pulls Ollama models, starts PM2
pm2 logs            # tail all process logs
pm2 logs worker     # tail worker only
pm2 status          # process health
pm2 stop all
```

### Backend only
```bash
cd backend
uv sync                                           # install/update deps
uv run uvicorn app.main:app --reload --port 8000  # API server
uv run python worker.py                           # OCR + RAG indexing worker
```

### Frontend only
```bash
cd frontend
pnpm install
pnpm dev            # Vite dev server on port 5173
pnpm build          # production build
pnpm lint
```

### External services required
```bash
# Ollama (OCR + embeddings + LLM) — port 11434
ollama serve
ollama pull minicpm-v        # OCR vision model
ollama pull nomic-embed-text # Embeddings
ollama pull llama3.2         # LLM for Q&A
```

### Environment variables (backend/.env)
```
DATABASE_URL=sqlite:///./app.db
UPLOAD_DIR=./uploads
DOTS_OCR_URL=http://localhost:11434/v1/chat/completions
DOTS_OCR_MODEL=minicpm-v
DOTS_OCR_PROMPT_MODE=Extract all text from this document image. Preserve the layout, headings, tables, and structure. Output as structured markdown.
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_LLM_MODEL=llama3.2
CHROMA_PERSIST_DIR=./chroma_db
RAG_N_RESULTS=5              # number of ChromaDB chunks retrieved per query
RAG_CONTEXT_WINDOW=10        # number of individual messages (not turns) sent as LLM context; 10 msgs = up to 5 user + 5 assistant
```

## Database Schema

Tables are auto-created via `Base.metadata.create_all()` on startup. No migration tool is used in dev (SQLite). For schema changes, add the column to the model and restart.

### `uploads`
| Column | Type | Notes |
|--------|------|-------|
| id | String(36) UUID PK | |
| filename | String(255) | original filename |
| file_path | String(512) | path on disk |
| file_size | Integer | bytes |
| mime_type | String(100) | |
| status | Enum | pending / processing / completed / failed |
| uploaded_at | DateTime | |
| processed_at | DateTime | nullable |
| total_chunks | Integer | nullable, count of OCRResult rows |
| error_message | Text | nullable |
| indexed_at | DateTime | nullable — set after ChromaDB indexing |

### `ocr_results`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK autoincrement | |
| upload_id | FK → uploads.id | cascade delete |
| chunk_order | Integer | 0-based order |
| chunk_data | Text | base64 slice (1024 bytes) |

OCR result is stored as: `JSON → base64 encode → split into 1024-byte chunks → stored as rows ordered by chunk_order`. Reconstruct by joining chunks in order then base64-decoding.

### `conversations`
| Column | Type | Notes |
|--------|------|-------|
| id | String(36) UUID PK | |
| title | String(255) | nullable, auto-set from first question |
| created_at | DateTime | |
| updated_at | DateTime | updated on each new message |

### `conversation_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK autoincrement | |
| conversation_id | FK → conversations.id | cascade delete |
| role | Enum | user / assistant |
| content | Text | message text |
| sources | Text | nullable, JSON array of `{upload_id, filename, page_number}` |
| created_at | DateTime | |

## API Routes

### Upload API (`backend/app/api/upload.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload file (multipart/form-data) |
| GET | `/api/uploads` | List uploads; params: skip, limit, status |
| GET | `/api/uploads/{id}` | Upload detail |
| GET | `/api/uploads/{id}/status` | Lightweight status poll |
| GET | `/api/uploads/{id}/file` | Stream original file |
| GET | `/api/uploads/{id}/result` | Reconstructed OCR JSON |
| GET | `/api/uploads/{id}/export/markdown` | Download as .md |
| GET | `/api/uploads/{id}/export/json` | Download as .json |
| POST | `/api/uploads/{id}/retry` | Reset failed upload to pending |

### RAG API (`backend/app/api/rag.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations` | List conversations (newest first) |
| GET | `/api/conversations/{id}` | Get conversation with messages |
| DELETE | `/api/conversations/{id}` | Delete conversation |
| POST | `/api/conversations/{id}/messages` | Ask a question, get answer + sources |

Ask message body: `{ "question": str, "upload_ids": [str] }` — `upload_ids` is optional; omit to search all docs.

## Key Conventions

### Backend
- All settings live in `app/config.py` as `Settings` fields. Never hardcode URLs, model names, or timeouts in other files — always import `settings`.
- DB sessions use `get_db()` via FastAPI `Depends`. Worker uses `SessionLocal()` directly (no DI framework).
- New API routers go in `backend/app/api/`, then register in `main.py` with `app.include_router(...)`.
- RAG modules (`rag/`) are pure functions — no FastAPI imports, no DB sessions. Keep them testable in isolation.
- OCR result JSON format: `{"file": str, "pages": [{"page_number": int, "content": str, "raw_response": dict}], "metadata": {"total_pages": int, "processing_time": float}}`. The `content` field is the raw string returned by the Ollama minicpm-v model (structured markdown with layout tags, not plain prose). This is the text embedded into ChromaDB as-is.
- ChromaDB document IDs are `{upload_id}_page_{page_number}` — deterministic so re-indexing is idempotent.
- Indexing errors in the worker are caught and logged but never mark the upload as FAILED.

### Frontend
- All HTTP calls go through `src/api/client.ts`. Do not use `fetch` or create new Axios instances elsewhere.
- All TypeScript interfaces live in `src/types/index.ts`.
- New pages: create in `src/pages/`, add route in `App.tsx`, add nav link in `Navigation.tsx`.
- Tailwind only — no inline styles, no CSS modules.
- Active nav link detection uses `useLocation()` and exact path matching.

### ChromaDB
- Uses pre-computed embeddings from Ollama. Do not configure a ChromaDB embedding function — always pass `embeddings=[...]` explicitly to `collection.upsert()` and `collection.query()`.
- Collection name: `vision_ocr_docs`. Metadata fields: `upload_id`, `filename`, `page_number`, `indexed_at`.

## What NOT to Do

- Do not run `alembic` migrations in dev — `create_all` handles SQLite schema automatically.
- Do not import from `app.rag` inside `app.models` or `app.database` (circular imports).
- Do not call `collection.query()` with `n_results` larger than `collection.count()` — it raises an error; `retriever.py` already guards this.
- Do not add authentication — this is a local-only POC.
- Do not hardcode `localhost` ports anywhere except `config.py` defaults.
- Do not create new Axios instances in frontend components — use the shared `api` instance in `client.ts`.
