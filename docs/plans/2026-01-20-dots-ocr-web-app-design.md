# dots.ocr Web Application Design

**Date**: 2026-01-20
**Purpose**: POC web application for uploading documents and processing them with dots.ocr

## Overview

A web application that allows users to upload documents (images, PDFs, multi-page documents), processes them using dots.ocr for OCR extraction, and displays results in a split-view interface with export capabilities.

## Technology Stack

- **Backend**: FastAPI (Python) with uv dependency management
- **Frontend**: React with Vite
- **Database**: SQLAlchemy ORM (SQLite for local dev, PostgreSQL for Docker/production)
- **Background Processing**: Multiple Python worker processes
- **Process Management**: PM2 for web server and workers
- **OCR Engine**: dots.ocr (https://github.com/rednote-hilab/dots.ocr)

## Architecture

### Three-Layer Architecture

1. **Frontend (React + Vite)**: Single-page application with upload interface and history view with split-pane display
2. **Backend (FastAPI)**: REST API for file upload, status checking, and result retrieval
3. **Background Workers**: Multiple parallel processes monitoring database for pending uploads and processing with dots.ocr

### Data Flow

1. User uploads file via React frontend
2. FastAPI saves file to disk and creates database record with "pending" status
3. Worker process picks up pending record using row-level locking
4. Worker processes file with dots.ocr
5. Worker encodes JSON result as base64, splits into 1024-byte chunks, stores in database
6. Frontend polls status endpoint
7. When complete, user views results in split view and can export as Markdown or JSON

## Database Schema

### uploads table
- `id` (UUID, primary key)
- `filename` (text, original filename)
- `file_path` (text, path to stored file)
- `file_size` (integer, bytes)
- `mime_type` (text, e.g., image/png, application/pdf)
- `status` (enum: pending, processing, completed, failed)
- `uploaded_at` (timestamp)
- `processed_at` (timestamp, nullable)
- `total_chunks` (integer, nullable, set after OCR completes)
- `error_message` (text, nullable)

### ocr_results table
- `id` (integer, primary key)
- `upload_id` (UUID, foreign key to uploads.id)
- `chunk_order` (integer, 0-indexed sequence)
- `chunk_data` (text, base64-encoded 1024-byte chunks)

**Rationale**: Large OCR results are split into chunks for efficient storage and retrieval. Results are base64-encoded before chunking for safe storage.

## API Endpoints

### POST /api/upload
- Accepts multipart/form-data file upload
- Validates file type (images, PDFs)
- Saves file to `uploads/{upload_id}/original.{ext}`
- Creates database record with status="pending"
- Returns: `{upload_id, status, filename}`

### GET /api/uploads
- Lists all uploads with pagination
- Query params: `page`, `limit`, `status` filter
- Returns: Array of upload metadata

### GET /api/uploads/{upload_id}
- Returns detailed upload metadata
- Does not include OCR chunks

### GET /api/uploads/{upload_id}/status
- Lightweight polling endpoint
- Returns: `{status, progress}`

### GET /api/uploads/{upload_id}/result
- Reconstructs full OCR result from chunks
- Decodes base64 and parses JSON
- Returns: Structured dots.ocr output

### GET /api/uploads/{upload_id}/export/markdown
- Downloads OCR result as .md file
- Content-Type: text/markdown
- Content-Disposition: attachment

### GET /api/uploads/{upload_id}/export/json
- Downloads complete OCR result as .json file
- Content-Type: application/json
- Content-Disposition: attachment

## Frontend Components

### UploadPage.tsx
- File drop zone with drag-and-drop support
- File type validation
- Upload progress bar
- Success message with link to history

### HistoryPage.tsx
- Left sidebar: List of uploads with filename, date, status badge
- Main area: Split view container
- Status polling for pending/processing uploads (2-3 second intervals)

### SplitView.tsx
- Left pane: Original file viewer (image preview or PDF embed)
- Right pane: Structured OCR result display
- Resizable divider
- Export buttons: "Download Markdown" and "Download JSON"

### OCRResultViewer.tsx
- Displays dots.ocr structured output
- Renders markdown sections, tables, formulas
- Shows bounding box info and element types
- Syntax highlighting for JSON structure

**Libraries**: React Router (navigation), Axios (API calls), Tailwind CSS (styling)

## Background Workers

### Worker Process Design

Multiple Python worker processes run in parallel, each:
1. Polling database every 5-10 seconds for pending uploads
2. Using SELECT FOR UPDATE for row-level locking to claim jobs
3. Processing one upload at a time with dots.ocr
4. Encoding results as base64, splitting into 1024-byte chunks
5. Storing chunks in ocr_results table
6. Updating upload status to completed/failed

### Concurrency

- PostgreSQL (production) handles concurrent reads/writes natively
- SQLite (local dev) uses WAL mode for better concurrency
- Row-level locking (SELECT FOR UPDATE) prevents multiple workers claiming same job
- Configurable worker count (e.g., 3-5 for POC)
- Each worker has independent database connection from pool

### Error Handling

- Failed processing updates status="failed" with error_message
- Configurable timeout (default: 300 seconds)
- Optional retry logic for transient failures

## Process Management with PM2

### ecosystem.config.js

```javascript
{
  apps: [
    {
      name: "web",
      script: "uvicorn",
      args: "app.main:app --host 0.0.0.0 --port 8000"
    },
    {
      name: "worker",
      script: "python",
      args: "worker.py",
      instances: 3
    }
  ]
}
```

### Commands
- Start: `pm2 start ecosystem.config.js`
- Status: `pm2 status`
- Logs: `pm2 logs`
- Stop: `pm2 stop all`
- Restart: `pm2 restart all`

## Configuration

### Environment Variables (.env)

- `UPLOAD_DIR`: Directory for uploaded files (default: ./uploads)
- `DATABASE_URL`: Database connection string
  - Local dev: `sqlite:///./app.db`
  - Docker/prod: `postgresql://user:password@postgres:5432/vision_db`
- `WORKER_POLL_INTERVAL`: Seconds between checks (default: 5)
- `WORKER_TIMEOUT`: Max OCR processing time (default: 300)
- `MAX_FILE_SIZE`: Upload limit in MB (default: 50)

**Docker-specific** (docker-compose.yml):
- `POSTGRES_USER`: Database user (default: vision_user)
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name (default: vision_db)

## Project Structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── database.py      # DB connection
│   │   └── api/             # Route handlers
│   ├── worker.py            # Background worker
│   ├── pyproject.toml       # uv dependencies
│   └── .env                 # Configuration
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   └── App.tsx          # Root component
│   ├── package.json
│   └── vite.config.ts
├── ecosystem.config.js      # PM2 configuration
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Backend container image
├── uploads/                 # Created at runtime
└── docs/plans/             # Design documents
```

## Docker Deployment

### Services (docker-compose.yml)

- **postgres**: PostgreSQL 15 database with persistent volume
- **backend**: FastAPI application with uvicorn
- **worker**: Multiple worker instances (3-5 replicas)
- **frontend**: Nginx serving React build, proxying API requests

### Dockerfile

Multi-stage build for backend:
1. Base stage: Python with uv and dots.ocr installation
2. Dependencies stage: Install Python packages via uv
3. Runtime stage: Copy app code and dependencies

### Volumes

- `postgres_data`: Persistent PostgreSQL data
- `uploads`: Shared volume for uploaded files (mounted in backend and workers)

## Setup Steps

### Development (Local with SQLite)
1. Install uv: `pip install uv`
2. Install dots.ocr in backend environment
3. Backend dependencies: `cd backend && uv sync`
4. Frontend dependencies: `cd frontend && npm install`
5. Set `DATABASE_URL=sqlite:///./app.db` in `.env`
6. Run database migrations to create tables: `alembic upgrade head`
7. Start application: `pm2 start ecosystem.config.js`

### Production (Docker)
1. Copy `.env.example` to `.env` and configure
2. Build and start: `docker-compose up -d`
3. Run migrations: `docker-compose exec backend alembic upgrade head`
4. View logs: `docker-compose logs -f`

## Security Considerations (POC)

- No authentication required (single-user/internal tool)
- File type validation on upload
- File size limits enforced
- No public deployment recommended without adding auth

## Future Enhancements (Out of Scope for POC)

- User authentication and multi-tenancy
- Cloud storage for uploaded files
- Redis-based job queue for better scalability
- WebSocket for real-time status updates
- Batch upload processing
- OCR result search and indexing
