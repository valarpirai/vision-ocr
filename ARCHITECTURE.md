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
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │   Upload Page    │  │  History Page    │  │   API Client        │   │
│  │  - Drag & Drop   │  │  - Split View    │  │   (Axios)           │   │
│  │  - File Upload   │  │  - Status Poll   │  │   - Upload          │   │
│  └──────────────────┘  │  - Export        │  │   - List/Get        │   │
│                         └──────────────────┘  │   - Download        │   │
│                                                └─────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTP/JSON
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│                      BACKEND (FastAPI + Uvicorn)                          │
│                         http://localhost:8000                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      REST API Endpoints                          │    │
│  │  POST   /api/upload              - Upload file                   │    │
│  │  GET    /api/uploads             - List uploads (paginated)      │    │
│  │  GET    /api/uploads/{id}        - Get upload details            │    │
│  │  GET    /api/uploads/{id}/status - Poll processing status        │    │
│  │  GET    /api/uploads/{id}/result - Get OCR result JSON           │    │
│  │  GET    /api/uploads/{id}/export/markdown - Download MD          │    │
│  │  GET    /api/uploads/{id}/export/json     - Download JSON        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │  SQLAlchemy      │  │  Pydantic        │  │  Configuration      │   │
│  │  Models          │  │  Schemas         │  │  (Settings)         │   │
│  │  - Upload        │  │  - Validation    │  │  - Database URL     │   │
│  │  - OCRResult     │  │  - Serialization │  │  - Upload Dir       │   │
│  └──────────────────┘  └──────────────────┘  │  - OCR URL          │   │
│                                                └─────────────────────┘   │
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
│  │  1. Poll DB for pending uploads (SELECT FOR UPDATE)              │   │
│  │  2. Update status to "processing"                                │   │
│  │  3. Load file from disk                                          │   │
│  │  4. Convert PDF to images (if needed)                            │   │
│  │  5. Encode images to base64                                      │   │
│  │  6. Call dots.ocr API for each page                              │   │
│  │  7. Receive structured OCR result                                │   │
│  │  8. Base64 encode result JSON                                    │   │
│  │  9. Split into 1024-byte chunks                                  │   │
│  │  10. Store chunks in database                                    │   │
│  │  11. Update status to "completed"                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                          │
│                                 │ HTTP POST /v1/chat/completions          │
│                                 │                                          │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │
                                  │
┌─────────────────────────────────▼────────────────────────────────────────┐
│                    dots.ocr vLLM Inference Server                          │
│                         http://localhost:8001                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       Vision-Language Model                      │    │
│  │                  rednote-hilab/dots.ocr (1.7B)                   │    │
│  │                                                                   │    │
│  │  Tasks:                                                          │    │
│  │  - Layout Detection                                              │    │
│  │  - Text Recognition                                              │    │
│  │  - Table Extraction                                              │    │
│  │  - Formula Recognition                                           │    │
│  │  - Reading Order                                                 │    │
│  │                                                                   │    │
│  │  Output: JSON with structured layout + text                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  Running on GPU with vLLM for fast inference                              │
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
dots.ocr vLLM Server
    │
    │ 6. POST /v1/chat/completions
    │    - Base64 encoded image
    │    - Prompt mode
    │
    │ 7. Model inference (GPU)
    │
    │ 8. Return structured JSON
    │    - Layout elements
    │    - Text content
    │    - Bounding boxes
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
    └─── Ready for viewing/export
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

### 4. Export Flow

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
- **Technology**: React 18, TypeScript, Vite, React Router, Axios

### Backend (FastAPI)
- **Responsibility**: REST API and business logic
- **Key Features**:
  - File upload handling and validation
  - Database operations
  - Result reconstruction from chunks
  - Export formatting
- **Technology**: FastAPI, SQLAlchemy, Pydantic, Uvicorn

### Worker Process
- **Responsibility**: Asynchronous OCR processing
- **Key Features**:
  - Database polling with row locking
  - Image/PDF handling
  - dots.ocr API integration
  - Result chunking and storage
- **Technology**: Python, requests, Pillow, pdf2image
- **Concurrency**: 3 parallel instances

### Database
- **Responsibility**: Persistent data storage
- **Key Features**:
  - Upload metadata tracking
  - Chunked OCR result storage
  - Status management
- **Technology**: SQLite (dev), PostgreSQL (prod)

### dots.ocr Server
- **Responsibility**: OCR inference
- **Key Features**:
  - Vision-language model inference
  - Multi-task OCR (layout, text, tables, formulas)
  - Multilingual support
- **Technology**: vLLM, PyTorch, CUDA

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
      └─ dots.ocr vLLM (port 8001)
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
      └─ External dots.ocr vLLM
         (port 8001, GPU required)
```

## Scalability Considerations

1. **Worker Scaling**: Add more worker instances (configurable in ecosystem.config.js or docker-compose.yml)
2. **Database**: Switch from SQLite to PostgreSQL for production
3. **File Storage**: Move to S3/object storage for distributed deployments
4. **OCR Server**: Scale vLLM horizontally with load balancer
5. **Frontend**: Add nginx reverse proxy for production
6. **Caching**: Add Redis for status polling optimization

## Security Notes

- No authentication (POC only)
- File type validation on upload
- File size limits enforced
- SQL injection protection (SQLAlchemy ORM)
- CORS configured for local development
