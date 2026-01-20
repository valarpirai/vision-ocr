# Vision OCR Web Application

A web application for uploading documents and processing them with dots.ocr for OCR extraction, displaying results in a split-view interface with export capabilities.

## Features

- File upload with drag-and-drop support
- Support for images (PNG, JPG), PDFs, and multi-page documents
- Background OCR processing with multiple workers
- Upload history with real-time status updates
- Split-view interface showing original file and OCR results
- Export results as Markdown or JSON
- SQLite for local development, PostgreSQL for production

## Technology Stack

- **Backend**: FastAPI, SQLAlchemy, Python 3.11+
- **Frontend**: React + TypeScript, Vite, React Router, Axios
- **Database**: SQLite (local), PostgreSQL (Docker)
- **OCR Engine**: dots.ocr (https://github.com/rednote-hilab/dots.ocr)
- **Process Management**: PM2 (local), Docker Compose (production)

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── config.py     # Configuration
│   │   ├── database.py   # Database setup
│   │   ├── models.py     # SQLAlchemy models
│   │   ├── schemas.py    # Pydantic schemas
│   │   └── main.py       # FastAPI application
│   ├── worker.py         # Background worker
│   ├── pyproject.toml    # Python dependencies
│   └── .env.example      # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── pages/        # Page components
│   │   ├── types/        # TypeScript types
│   │   └── App.tsx       # Main app component
│   └── package.json      # Node dependencies
├── docs/
│   ├── QUICKSTART.md     # Quick start guide
│   ├── ARCHITECTURE.md   # System architecture
│   ├── DOTS_OCR_SETUP.md # dots.ocr setup guide
│   └── plans/            # Design documentation
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile            # Backend container image
├── ecosystem.config.js   # PM2 configuration
├── start.sh              # Startup script
├── test_integration.py   # Integration tests
└── README.md
```

## Setup

### Prerequisites

- Python 3.10+ with uv installed (`pip install uv`)
- Node.js 18+ with npm
- PM2 (`npm install -g pm2`) for local development
- Docker and Docker Compose for production deployment
- **dots.ocr vLLM server** (see [docs/DOTS_OCR_SETUP.md](docs/DOTS_OCR_SETUP.md) for detailed instructions)

### Local Development (SQLite)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vision
   ```

2. **Backend setup**
   ```bash
   cd backend
   uv sync
   cp .env.example .env
   # Edit .env if needed (defaults to SQLite)
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Setup dots.ocr vLLM Server** (REQUIRED)

   **See [docs/DOTS_OCR_SETUP.md](docs/DOTS_OCR_SETUP.md) for complete setup instructions.**

   Quick start:
   ```bash
   # In a separate terminal
   conda create -n dots_ocr python=3.12
   conda activate dots_ocr
   git clone https://github.com/rednote-hilab/dots.ocr.git
   cd dots.ocr
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
   pip install -e .
   python3 tools/download_model.py

   # Start vLLM server (port 8001 to avoid conflict with backend)
   vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8001
   ```

5. **Start all services with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 logs  # View logs
   pm2 status  # Check status
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Production Deployment (Docker + PostgreSQL)

1. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials
   ```

2. **Build and start services**
   ```bash
   docker-compose up -d
   ```

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

4. **Stop services**
   ```bash
   docker-compose down
   ```

## API Endpoints

- `POST /api/upload` - Upload a file
- `GET /api/uploads` - List all uploads (with pagination and status filter)
- `GET /api/uploads/{upload_id}` - Get upload details
- `GET /api/uploads/{upload_id}/status` - Get upload status
- `GET /api/uploads/{upload_id}/result` - Get OCR result as JSON
- `GET /api/uploads/{upload_id}/export/markdown` - Download as Markdown
- `GET /api/uploads/{upload_id}/export/json` - Download as JSON

## Development

### Running Backend Only

```bash
cd backend
uv run uvicorn app.main:app --reload
```

### Running Worker Only

```bash
cd backend
uv run python worker.py
```

### Running Frontend Only

```bash
cd frontend
npm run dev
```

## Architecture

### Data Flow

1. User uploads file via React frontend
2. FastAPI saves file to disk and creates database record with "pending" status
3. Worker process picks up pending record using row-level locking
4. Worker processes file with dots.ocr
5. Worker encodes JSON result as base64, splits into 1024-byte chunks, stores in database
6. Frontend polls status endpoint
7. When complete, user views results in split view and can export as Markdown or JSON

### Background Workers

Multiple Python worker processes run in parallel:
- Poll database every 5 seconds for pending uploads
- Use `SELECT FOR UPDATE` with `skip_locked=True` for row-level locking
- Process one upload at a time per worker
- SQLite (WAL mode) for local dev, PostgreSQL for production

### OCR Result Storage

Large OCR results are stored efficiently:
1. Result JSON is base64-encoded
2. Split into 1024-byte chunks
3. Each chunk stored as separate row with `chunk_order`
4. Reconstructed by concatenating chunks in order and decoding

## Configuration

### Environment Variables

**Backend (`backend/.env`)**:
- `DATABASE_URL` - Database connection string (SQLite or PostgreSQL)
- `UPLOAD_DIR` - Directory for uploaded files (default: `./uploads`)
- `WORKER_POLL_INTERVAL` - Seconds between worker polls (default: `5`)
- `WORKER_TIMEOUT` - Max OCR processing time in seconds (default: `300`)
- `MAX_FILE_SIZE` - Upload size limit in bytes (default: `52428800` = 50MB)
- `DOTS_OCR_URL` - dots.ocr vLLM API URL (default: `http://localhost:8001/v1/chat/completions`)
- `DOTS_OCR_MODEL` - Model name (default: `rednote-hilab/dots.ocr`)
- `DOTS_OCR_PROMPT_MODE` - Prompt mode (default: `prompt_layout_all_en`)

**Docker Compose (`.env`)**:
- `POSTGRES_USER` - PostgreSQL username
- `POSTGRES_PASSWORD` - PostgreSQL password
- `POSTGRES_DB` - PostgreSQL database name

## Documentation

- **[docs/QUICKSTART.md](docs/QUICKSTART.md)** - Quick start guide (5-minute setup)
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture, data flows, and deployment patterns
- **[docs/DOTS_OCR_SETUP.md](docs/DOTS_OCR_SETUP.md)** - Detailed dots.ocr installation and configuration guide

## TODO / Future Enhancements

- [x] Integrate actual dots.ocr library
- [x] Support multi-page PDFs
- [ ] Add user authentication
- [ ] Implement image/PDF preview in split view
- [ ] Add batch upload support
- [ ] Implement search and filtering in history
- [ ] Add WebSocket for real-time status updates
- [ ] Deploy to cloud with object storage for files

## License

[Your License Here]
