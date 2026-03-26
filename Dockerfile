# Multi-stage Dockerfile for backend

FROM python:3.11-slim

# Install system dependencies
# poppler-utils: required by pdf2image to convert PDF pages to images
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

WORKDIR /app

# Install Python dependencies (cached layer)
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen

# Copy application code
COPY backend/app ./app
COPY backend/worker.py ./

RUN mkdir -p uploads

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
