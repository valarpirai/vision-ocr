# Vision OCR Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                 │
│                         http://localhost:5173                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTP REST API
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │   Upload Page    │  │  History Page    │  │   Search Page    │    │
│  │  - Drag & Drop   │  │  - Split View    │  │  - Conversations │    │
│  │  - File Upload   │  │  - Status Poll   │  │  - Doc Filter    │    │
│  └──────────────────┘  │  - Export        │  │  - Chat + RAG    │    │
│                         └──────────────────┘  └──────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTP/JSON
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                      BACKEND (FastAPI + Uvicorn)                          │
│                         http://localhost:8000                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      REST API Endpoints                          │    │
│  │  POST   /api/upload                        - Upload file         │    │
│  │  GET    /api/uploads                       - List uploads        │    │
│  │  GET    /api/uploads/{id}                  - Upload detail       │    │
│  │  GET    /api/uploads/{id}/status           - Status poll         │    │
│  │  GET    /api/uploads/{id}/file             - Stream original file │    │
│  │  GET    /api/uploads/{id}/result           - OCR result JSON     │    │
│  │  GET    /api/uploads/{id}/export/markdown  - Download MD         │    │
│  │  GET    /api/uploads/{id}/export/json      - Download JSON       │    │
│  │  POST   /api/uploads/{id}/retry            - Retry failed        │    │
│  │  POST   /api/conversations                 - Create conversation │    │
│  │  GET    /api/conversations                 - List conversations  │    │
│  │  GET    /api/conversations/{id}            - Get with messages   │    │
│  │  DELETE /api/conversations/{id}            - Delete              │    │
│  │  POST   /api/conversations/{id}/messages   - Ask question        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │  SQLAlchemy      │  │  Pydantic        │  │  Configuration      │   │
│  │  Models          │  │  Schemas         │  │  (Settings)         │   │
│  │  - Upload        │  │  - Validation    │  │  - Database URL     │   │
│  │  - OCRResult     │  │  - Serialization │  │  - Ollama URLs      │   │
│  │  - Conversation  │  │                  │  │  - ChromaDB dir     │   │
│  │  - Conv.Message  │  │                  │  │  - OCR URL          │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    │ Database Access         │ File Storage
                    │                         │
        ┌───────────▼──────────┐    ┌────────▼────────┐
        │     DATABASE         │    │    FILESYSTEM    │
        │  SQLite / PostgreSQL │    │   ./uploads/     │
        │                      │    │   {upload_id}/   │
        │  ┌─────────────────┐ │    │   original.*     │
        │  │ uploads table   │ │    └─────────────────┘
        │  │ - id (UUID)     │ │
        │  │ - filename      │ │
        │  │ - status        │ │
        │  │ - uploaded_at   │ │
        │  │ - file_path     │ │
        │  │ - total_chunks  │ │
        │  └─────────────────┘ │
        │                      │
        │  ┌─────────────────┐ │
        │  │ocr_results table│ │
        │  │ - id            │ │
        │  │ - upload_id     │ │
        │  │ - chunk_order   │ │
        │  │ - chunk_data    │ │
        │  │   (base64)      │ │
        │  └─────────────────┘ │
        └──────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND WORKERS (x3 instances)                      │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                       Worker Process Loop                         │   │
│  │  1. Poll DB for pending uploads (SELECT FOR UPDATE SKIP LOCKED)  │   │
│  │  2. Update status to "processing"                                │   │
│  │  3. Load file from disk                                          │   │
│  │  4. Convert PDF to images (if needed)                            │   │
│  │  5. Encode images to base64                                      │   │
│  │  6. Call Ollama minicpm-v API for each page                      │   │
│  │  7. Receive structured OCR result                                │   │
│  │  8. Base64 encode result JSON                                    │   │
│  │  9. Split into 1024-byte chunks                                  │   │
│  │  10. Store chunks in database                                    │   │
│  │  11. Update status to "completed"                                │   │
│  │  12. Embed each page via Ollama (nomic-embed-text)               │   │
│  │  13. Upsert page vectors into ChromaDB                           │   │
│  │  14. Set indexed_at timestamp (indexing failure is non-fatal)    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│                                 │ HTTP POST /v1/chat/completions          │
│                                 │                                          │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                    Ollama Inference Server                                 │
│                         http://localhost:11434                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       Vision-Language Model                      │    │
│  │                  minicpm-v (via Ollama)                          │    │
│  │                                                                   │    │
│  │  Tasks:                                                          │    │
│  │  - Layout Detection                                              │    │
│  │  - Text Recognition                                              │    │
│  │  - Document OCR                                                  │    │
│  │  - Structured Markdown Output                                    │    │
│  │                                                                   │    │
│  │  Output: JSON with structured layout + text                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  Runs on CPU via Ollama (Apple Silicon compatible)                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Upload Flow

```
User Browser
    │
    │ 1. Select file (drag & drop or click)
    │
    ▼
Frontend (UploadPage)
    │
    │ 2. POST /api/upload (multipart/form-data)
    │
    ▼
Backend (FastAPI)
    │
    │ 3. Validate file type & size
    │ 4. Generate UUID
    │ 5. Save file to ./uploads/{uuid}/original.*
    │ 6. Create DB record (status=PENDING)
    │
    ▼
Database
    │
    │ Status: PENDING ✓
    └─── Upload queued for processing
```

### 2. Processing Flow

```
Worker Process (polling every 5s)
    │
    │ 1. SELECT FOR UPDATE (row locking)
    │
    ▼
Database
    │
    │ 2. Get pending upload
    │
    ▼
Worker Process
    │
    │ 3. Update status=PROCESSING
    │ 4. Load file from disk
    │ 5. If PDF: convert to images
    │
    ▼
Ollama Server (minicpm-v)
    │
    │ 6. POST /v1/chat/completions
    │    - Base64 encoded image
    │    - Prompt: Extract text with layout
    │
    │ 7. Model inference (CPU)
    │
    │ 8. Return structured JSON
    │    - Markdown-formatted text
    │    - Layout preserved
    │    - Document structure
    │
    ▼
Worker Process
    │
    │ 9. Base64 encode result
    │ 10. Split into 1024-byte chunks
    │ 11. Store chunks in DB
    │ 12. Update status=COMPLETED
    │
    ▼
Database
    │
    │ Status: COMPLETED ✓
    │
    ▼
RAG Indexing (same synchronous call — see "RAG Indexing Flow" below)
    └─── indexed_at timestamp set; document is now searchable
```

### 3. Viewing Flow

```
User Browser
    │
    │ 1. Navigate to /history
    │
    ▼
Frontend (HistoryPage)
    │
    │ 2. GET /api/uploads (poll every 3s)
    │
    ▼
Backend
    │
    │ 3. Return list with status
    │
    ▼
Frontend
    │
    │ 4. User selects upload
    │ 5. GET /api/uploads/{id}/result
    │
    ▼
Backend
    │
    │ 6. Query all chunks (ORDER BY chunk_order)
    │ 7. Concatenate chunks
    │ 8. Base64 decode
    │ 9. Parse JSON
    │ 10. Return result
    │
    ▼
Frontend (Split View)
    │
    ├─ Left Panel: Original file info
    └─ Right Panel: OCR result display
```

### 4. RAG Indexing Flow (runs within the same worker call, after step 11)

```
Worker Process
    │
    │ After status=COMPLETED
    │
    ▼
OCR Result (in memory)
    │
    │ For each page: page["content"] (plain text)
    │
    ▼
Ollama (nomic-embed-text)
    │
    │ POST /api/embeddings
    │ Returns: List[float] (768 dims)
    │
    ▼
ChromaDB (vision_ocr_docs collection)
    │
    │ collection.upsert(
    │   id="{upload_id}_page_{page_number}",
    │   embedding=[...],
    │   document=content,
    │   metadata={upload_id, filename, page_number}
    │ )
    │
    ▼
Upload.indexed_at = now()
    └─── Document is now searchable
```

### 5. RAG Search Flow

```
User Browser (SearchPage)
    │
    │ 1. POST /api/conversations          (create or reuse)
    │ 2. POST /api/conversations/{id}/messages
    │    body: { question, upload_ids? }
    │
    ▼
Backend (rag.py)
    │
    │ 3. Load prior messages (last 10) as history
    │ 4. Embed question via Ollama (nomic-embed-text)
    │
    ▼
ChromaDB
    │
    │ 5. Query top-5 nearest chunks
    │    (filtered by upload_ids if provided)
    │
    ▼
Backend
    │
    │ 6. Build system prompt with retrieved chunks
    │ 7. POST /api/chat to Ollama (llama3.2)
    │    with: system prompt + history + question
    │
    ▼
Ollama (llama3.2)
    │
    │ 8. Generate answer
    │
    ▼
Backend
    │
    │ 9. Persist user message + assistant message (with sources JSON)
    │ 10. Auto-title conversation if first message
    │
    ▼
Frontend
    │
    │ 11. Display answer + collapsible source citations
    └─── (filename + page number, links to /history)
```

### 6. Export Flow

```
User Browser
    │
    │ Click "Download Markdown" or "Download JSON"
    │
    ▼
Frontend
    │
    │ GET /api/uploads/{id}/export/markdown
    │ OR
    │ GET /api/uploads/{id}/export/json
    │
    ▼
Backend
    │
    │ 1. Reconstruct result from chunks
    │ 2. Extract content from all pages
    │ 3. Format as Markdown or JSON
    │ 4. Set Content-Disposition: attachment
    │
    ▼
User Browser
    │
    │ Download file
    │ - {filename}.md
    │ - {filename}.json
    └─── Saved to Downloads
```

## Component Responsibilities

### Frontend (React + TypeScript)
- **Responsibility**: User interface and interaction
- **Key Features**:
  - File upload with drag-and-drop
  - Real-time status polling
  - Split-view result display
  - Export functionality
  - RAG search with conversation history and source citations
- **Technology**: React 19, TypeScript, Vite 7, React Router 7, Axios, Tailwind CSS 4

### Backend (FastAPI)
- **Responsibility**: REST API and business logic
- **Key Features**:
  - File upload handling and validation
  - Database operations
  - Result reconstruction from chunks
  - Export formatting
  - Conversation management for RAG search
- **Technology**: FastAPI, SQLAlchemy 2, Pydantic, Uvicorn

### Worker Process
- **Responsibility**: Asynchronous OCR processing and RAG indexing
- **Key Features**:
  - Database polling with row locking (`SELECT FOR UPDATE SKIP LOCKED`)
  - Image/PDF handling
  - Ollama minicpm-v API integration
  - Result chunking and storage
  - Auto-indexing completed documents into ChromaDB
- **Technology**: Python, requests, Pillow, pdf2image
- **Concurrency**: 3 parallel instances

### Database
- **Responsibility**: Persistent data storage
- **Key Features**:
  - Upload metadata tracking
  - Chunked OCR result storage
  - Conversation and message history for RAG
- **Technology**: SQLite (dev), PostgreSQL (prod)

### RAG Layer
- **Responsibility**: Semantic search over OCR'd document content
- **Key Features**:
  - Per-page embedding and vector storage
  - Filtered search by document selection
  - Answer generation with source attribution
  - Persistent multi-turn conversation history
- **Technology**: ChromaDB (vector store), Ollama `nomic-embed-text` (embeddings), Ollama `llama3.2` (LLM)

### Ollama Server
- **Responsibility**: OCR inference via minicpm-v
- **Key Features**:
  - Vision-language model inference
  - Document OCR with layout preservation
  - Structured markdown output
  - OpenAI-compatible API
- **Technology**: Ollama, minicpm-v model

## Deployment Architectures

### Local Development

```
┌──────────────┐
│   PM2        │
│              │
│  ├─ backend  │ (port 8000)
│  ├─ worker×3 │
│  └─ frontend │ (port 5173)
└──────────────┘
      │
      ├─ SQLite (./app.db)
      ├─ ChromaDB (./chroma_db/)
      └─ Ollama (port 11434)  ← minicpm-v + nomic-embed-text + llama3.2
```

### Docker Production

```
┌─────────────────────────────────┐
│      Docker Compose             │
│                                 │
│  ┌───────────┐  ┌────────────┐ │
│  │ postgres  │  │  frontend  │ │
│  │ (port     │  │  (port     │ │
│  │  5432)    │  │   5173)    │ │
│  └───────────┘  └────────────┘ │
│                                 │
│  ┌───────────┐  ┌────────────┐ │
│  │  backend  │  │  worker×3  │ │
│  │ (port     │  │            │ │
│  │  8000)    │  │            │ │
│  └───────────┘  └────────────┘ │
│                                 │
│  Shared Volumes:                │
│  - postgres_data                │
│  - uploads_data                 │
└─────────────────────────────────┘
      │
      └─ External Ollama Server
         (port 11434, can run on same host)
```

## Scalability Considerations

1. **Worker Scaling**: Add more worker instances (configurable in ecosystem.config.js or docker-compose.yml)
2. **Database**: Switch from SQLite to PostgreSQL for production
3. **File Storage**: Move to S3/object storage for distributed deployments
4. **OCR Server**: Deploy multiple Ollama instances with load balancer
5. **Frontend**: Add nginx reverse proxy for production
6. **Caching**: Add Redis for status polling optimization
7. **Vector Store**: ChromaDB can be replaced with a distributed vector DB (Qdrant, Weaviate) for large-scale deployments
8. **LLM**: Swap `llama3.2` or `minicpm-v` for larger/faster Ollama models via env vars; no code changes needed

## Security Notes

- No authentication (POC only)
- File type validation on upload
- File size limits enforced
- SQL injection protection (SQLAlchemy ORM)
- CORS configured for local development
