# Quick Start Guide

Get the Vision OCR application running in 5 minutes!

## Prerequisites Check

Before starting, ensure you have:

- [x] Python 3.10+ installed
- [x] Node.js 18+ installed
- [x] Git installed
- [x] CUDA-capable GPU (optional but recommended for dots.ocr)

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

## Step 3: Setup dots.ocr (Required for OCR)

### Option A: Quick Setup (Recommended)

```bash
# Create conda environment
conda create -n dots_ocr python=3.12
conda activate dots_ocr

# Clone and install dots.ocr
git clone https://github.com/rednote-hilab/dots.ocr.git ~/dots.ocr
cd ~/dots.ocr

# Install PyTorch with CUDA 12.8
pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu128

# Install dots.ocr
pip install -e .

# Download model weights (~2GB)
python3 tools/download_model.py
```

### Option B: CPU Only (Slower)

```bash
# Use CPU PyTorch instead
pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cpu
```

**See [DOTS_OCR_SETUP.md](DOTS_OCR_SETUP.md) for detailed setup and troubleshooting.**

## Step 4: Start the Application

### Terminal 1: Start dots.ocr Server

```bash
conda activate dots_ocr
cd ~/dots.ocr

# Start vLLM server on port 8001
vllm serve rednote-hilab/dots.ocr \
  --trust-remote-code \
  --async-scheduling \
  --port 8001
```

Wait for "Application startup complete" message.

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

### Option 2: Integration Test Script

```bash
# Run automated tests
python3 test_integration.py
```

This will check:
- ✓ Backend health
- ✓ dots.ocr server connectivity
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

### dots.ocr Server Not Starting

Check CUDA availability:
```bash
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

If CUDA is not available, use CPU mode (will be slower).

### Workers Not Processing

Check worker logs:
```bash
pm2 logs worker
```

Make sure dots.ocr server is running and accessible at `http://localhost:8001`.

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

# Stop dots.ocr server
# Press Ctrl+C in the terminal where vLLM is running
```

## Next Steps

- **[README.md](../README.md)** - Full documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture
- **[DOTS_OCR_SETUP.md](DOTS_OCR_SETUP.md)** - Detailed dots.ocr setup

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

1. Check dots.ocr server logs
2. Verify API URL in `backend/.env`:
   ```
   DOTS_OCR_URL=http://localhost:8001/v1/chat/completions
   ```
3. Test dots.ocr directly:
   ```bash
   curl http://localhost:8001/health
   ```

### Upload fails

- Check file size (max 50MB by default)
- Verify file type (PNG, JPG, PDF, TIFF only)
- Check backend logs: `pm2 logs backend`

## Performance Tips

- **GPU**: Use CUDA for 10-50x faster OCR processing
- **Workers**: Adjust worker count in `ecosystem.config.js` (default: 3)
- **Chunk Size**: Increase if you have very large OCR results
- **Polling**: Adjust `WORKER_POLL_INTERVAL` in `.env` for faster/slower polling

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

# Terminal 4: dots.ocr server
vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8001
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

**Note**: dots.ocr server needs to be run separately with GPU access.

---

**Need Help?** Check the documentation or create an issue on GitHub.

Enjoy fast, accurate document OCR with Vision OCR! 🚀
