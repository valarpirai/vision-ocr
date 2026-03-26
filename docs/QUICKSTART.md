# Quick Start Guide

Get the Vision OCR application running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:

- [x] Python 3.10+ installed
- [x] Node.js 18+ installed
- [x] Git installed
- [x] Ollama installed (https://ollama.com)

## Step 1: Install Dependencies

```bash
# Install uv (Python package manager)
pip install uv

# Install PM2 (process manager)
npm install -g pm2

# Clone the repository (if not already done)
git clone <repository-url>
cd vision
```

## Step 2: Install Application Dependencies

```bash
# Backend
cd backend
uv sync
cd ..

# Frontend
cd frontend
npm install
cd ..
```

## Step 3: Setup Ollama (Required for OCR and RAG Search)

Install Ollama from https://ollama.com, then pull the required models:

```bash
# Start Ollama (runs on port 11434 by default)
ollama serve

# In another terminal, pull the required models
ollama pull minicpm-v          # OCR vision model
ollama pull nomic-embed-text   # embedding model
ollama pull llama3.2           # LLM for answer generation
```

Verify models are available:
```bash
ollama list
```

## Step 4: Start the Application

### Terminal 1: Start Ollama

```bash
ollama serve
```

### Terminal 2: Start Vision OCR Application

```bash
cd /path/to/vision

# Easy start with script
./start.sh

# Or manually with PM2
pm2 start ecosystem.config.js
pm2 logs
```

## Step 5: Access the Application

Open your browser:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Step 6: Test the Application

### Option 1: Web Interface

1. Go to http://localhost:5173
2. Drag and drop an image or PDF
3. Click "Upload"
4. Navigate to "View Upload History"
5. Watch the status change from "pending" → "processing" → "completed"
6. Click on the upload to view results
7. Download as Markdown or JSON

**RAG Search:**

1. Navigate to the "Search" page
2. Click "New Chat" to start a conversation
3. Optionally filter to specific documents using the document selector
4. Type your question and press Enter
5. View the answer along with source document references
6. Ask follow-up questions — conversation context is maintained

### Option 2: Integration Test Script

```bash
# Run automated tests
python3 test_integration.py
```

This will check:
- ✓ Backend health
- ✓ Ollama connectivity
- ✓ API endpoints
- ✓ Database setup

## Common Issues

### Port Already in Use

If port 8000 or 5173 is already in use:

```bash
# Check what's using the port
lsof -i :8000
lsof -i :5173

# Kill the process
kill -9 <PID>
```

### Workers Not Processing

Check worker logs:
```bash
pm2 logs worker
```

Make sure Ollama is running and accessible at `http://localhost:11434`.

### Database Locked

If you see "database is locked" errors:
```bash
pm2 stop all
rm backend/app.db
pm2 start ecosystem.config.js
```

## Stop the Application

```bash
# Stop all PM2 processes
pm2 stop all

# Or delete all processes
pm2 delete all

# Stop Ollama server
# Press Ctrl+C in the terminal where Ollama is running
```

## Next Steps

- **[README.md](../README.md)** - Full documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture

## Troubleshooting

### Backend won't start

```bash
cd backend
uv run uvicorn app.main:app --reload
# Check for errors in output
```

### Frontend won't start

```bash
cd frontend
npm run dev
# Check for errors in output
```

### OCR processing fails

1. Check Ollama is running: `ollama list`
2. Verify API URL in `backend/.env`:
   ```
   DOTS_OCR_URL=http://localhost:11434/v1/chat/completions
   DOTS_OCR_MODEL=minicpm-v
   ```
3. Test Ollama directly:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Upload fails

- Check file size (max 50MB by default)
- Verify file type (PNG, JPG, PDF, TIFF, Markdown, Text supported)
- Check backend logs: `pm2 logs backend`

## RAG Search Troubleshooting

### Ollama not running

```bash
# Start Ollama
ollama serve

# Verify it is accessible
curl http://localhost:11434/api/tags
```

### Models not found

```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

### Search returns no results

Ensure documents have been processed (status: completed) before searching. Documents are indexed into ChromaDB automatically after OCR completes. Check worker logs:

```bash
pm2 logs worker
# Look for: "Indexed N page(s) for upload ..."
```

### Slow answers

llama3.2 runs on CPU if no GPU is available. Consider using a smaller model by setting `OLLAMA_LLM_MODEL=llama3.2:1b` in your environment.

## Performance Tips

- **Workers**: Adjust worker count in `ecosystem.config.js` (default: 3)
- **Chunk Size**: Increase if you have very large OCR results
- **Polling**: Adjust `WORKER_POLL_INTERVAL` in `.env` for faster/slower polling
- **RAG Results**: Adjust `RAG_N_RESULTS` to control how many document chunks are retrieved per query
- **OCR Speed**: minicpm-v runs on CPU via Ollama; consider using a smaller model if speed is critical

## Development Mode

For development with hot reload:

```bash
# Terminal 1: Backend with auto-reload
cd backend
uv run uvicorn app.main:app --reload

# Terminal 2: Frontend with hot module replacement
cd frontend
npm run dev

# Terminal 3: Worker (restart manually when code changes)
cd backend
uv run python worker.py

# Terminal 4: Ollama (for OCR and RAG search)
ollama serve
```

## Docker Deployment

For production deployment with Docker:

```bash
# Create .env file
cp .env.example .env
# Edit .env with PostgreSQL credentials

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Note**: Ollama server needs to be run separately or added to the docker-compose configuration.

---

**Need Help?** Check the documentation or create an issue on GitHub.

Enjoy fast, accurate document OCR with Vision OCR! 🚀
