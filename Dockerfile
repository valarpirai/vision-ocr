# Multi-stage Dockerfile for backend

FROM python:3.11-slim as base

# Install uv
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy backend files
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY backend/app ./app
COPY backend/worker.py ./

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8000

# Default command (can be overridden in docker-compose)
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
