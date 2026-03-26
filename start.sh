#!/bin/bash

# Vision OCR Startup Script

set -e

echo "=========================================="
echo "Vision OCR Application Startup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}ERROR: PM2 is not installed${NC}"
    echo "Install PM2 with: npm install -g pm2"
    exit 1
fi

# Check if backend dependencies are installed
if [ ! -d "backend/.venv" ]; then
    echo -e "${YELLOW}Backend dependencies not found. Installing...${NC}"
    cd backend
    ~/.local/bin/uv sync
    cd ..
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Frontend dependencies not found. Installing...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Create .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend/.env from .env.example${NC}"
    cp backend/.env.example backend/.env
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${YELLOW}WARNING: Ollama is not running at http://localhost:11434${NC}"
    echo "RAG search features will not work without Ollama."
    echo "Start Ollama with: ollama serve"
    echo ""
else
    echo -e "${GREEN}Ollama is running.${NC}"
    # Pull required models if not already present
    echo "Checking Ollama models..."
    ollama pull nomic-embed-text 2>/dev/null || true
    ollama pull llama3.2 2>/dev/null || true
    echo -e "${GREEN}Ollama models ready.${NC}"
    echo ""
fi

echo -e "${GREEN}Starting all services with PM2...${NC}"
pm2 start ecosystem.config.js

echo ""
echo -e "${GREEN}Services started!${NC}"
echo ""
echo "View logs: pm2 logs"
echo "View status: pm2 status"
echo "Stop all: pm2 stop all"
echo ""
echo -e "${BLUE}Application URLs:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}IMPORTANT: Make sure dots.ocr vLLM server is running!${NC}"
echo "Start dots.ocr with:"
echo "  vllm serve rednote-hilab/dots.ocr --trust-remote-code --async-scheduling --port 8001"
echo ""
echo -e "${YELLOW}IMPORTANT: Make sure Ollama is running for RAG search!${NC}"
echo "Start Ollama with: ollama serve"
echo ""
echo "See docs/DOTS_OCR_SETUP.md for detailed setup instructions."
echo ""
