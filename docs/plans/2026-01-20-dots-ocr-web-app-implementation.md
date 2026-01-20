# dots.ocr Web Application Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web application for uploading documents and processing them with dots.ocr OCR engine, displaying results in a split-view interface with export capabilities.

**Architecture:** FastAPI backend serves REST API for file uploads and result retrieval. React frontend provides upload interface and history view with split-pane display. Multiple Python worker processes monitor database for pending uploads and process them asynchronously with dots.ocr. PostgreSQL (Docker) or SQLite (local dev) stores metadata and chunked OCR results.

**Tech Stack:** FastAPI, React + Vite, SQLAlchemy, PostgreSQL/SQLite, dots.ocr, PM2, Docker Compose

---

## Prerequisites

- Python 3.10+ with uv installed
- Node.js 18+ with npm
- Docker and Docker Compose (for production deployment)
- PM2 (`npm install -g pm2`)
- dots.ocr library installed in Python environment

---

## Task 1: Backend Project Structure

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`

**Step 1: Create backend directory structure**

Run:
```bash
mkdir -p backend/app/api
touch backend/app/__init__.py
touch backend/app/api/__init__.py
```

**Step 2: Create pyproject.toml with uv dependencies**

Create `backend/pyproject.toml`:
```toml
[project]
name = "vision-ocr-backend"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.12.0",
    "python-multipart>=0.0.6",
    "python-dotenv>=1.0.0",
    "psycopg2-binary>=2.9.9",
    "pydantic-settings>=2.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**Step 3: Create .env.example**

Create `backend/.env.example`:
```env
DATABASE_URL=sqlite:///./app.db
UPLOAD_DIR=./uploads
WORKER_POLL_INTERVAL=5
WORKER_TIMEOUT=300
MAX_FILE_SIZE=52428800
```

**Step 4: Install dependencies**

Run:
```bash
cd backend
uv sync
```

Expected: Dependencies installed, `.venv` created

**Step 5: Commit**

Run:
```bash
git add backend/
git commit -m "feat: initialize backend project with uv and dependencies

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Database Configuration and Models

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/models.py`
- Create: `backend/app/config.py`

**Step 1: Create config.py for settings**

Create `backend/app/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    upload_dir: str = "./uploads"
    worker_poll_interval: int = 5
    worker_timeout: int = 300
    max_file_size: int = 52428800

    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 2: Create database.py for connection**

Create `backend/app/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 3: Create models.py with database tables**

Create `backend/app/models.py`:
```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from .database import Base

class UploadStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Upload(Base):
    __tablename__ = "uploads"

    id = Column(UUID(as_uuid=True) if "postgresql" in str(Base.metadata.bind) else String(36),
                primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    status = Column(Enum(UploadStatus), default=UploadStatus.PENDING, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)
    total_chunks = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    ocr_results = relationship("OCRResult", back_populates="upload", cascade="all, delete-orphan")

class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_id = Column(String(36), ForeignKey("uploads.id", ondelete="CASCADE"), nullable=False)
    chunk_order = Column(Integer, nullable=False)
    chunk_data = Column(Text, nullable=False)

    upload = relationship("Upload", back_populates="ocr_results")
```

**Step 4: Commit**

Run:
```bash
git add backend/app/
git commit -m "feat: add database configuration and models

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas.py`

**Step 1: Create schemas.py**

Create `backend/app/schemas.py`:
```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from .models import UploadStatus

class UploadResponse(BaseModel):
    id: str
    filename: str
    status: UploadStatus
    uploaded_at: datetime

    class Config:
        from_attributes = True

class UploadDetail(BaseModel):
    id: str
    filename: str
    file_size: int
    mime_type: str
    status: UploadStatus
    uploaded_at: datetime
    processed_at: Optional[datetime]
    total_chunks: Optional[int]
    error_message: Optional[str]

    class Config:
        from_attributes = True

class StatusResponse(BaseModel):
    status: UploadStatus
    progress: Optional[int] = None
```

**Step 2: Commit**

Run:
```bash
git add backend/app/schemas.py
git commit -m "feat: add Pydantic schemas

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Upload API Endpoint

**Files:**
- Create: `backend/app/api/upload.py`
- Create: `backend/app/main.py`

**Step 1: Create upload.py with POST /api/upload**

Create `backend/app/api/upload.py`:
```python
import os
import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload, UploadStatus
from ..schemas import UploadResponse
from ..config import settings

router = APIRouter()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf", ".tiff", ".tif"}

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Validate file type
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Check file size
    file_content = await file.read()
    if len(file_content) > settings.max_file_size:
        raise HTTPException(status_code=413, detail="File too large")

    # Generate upload ID and save file
    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.upload_dir, upload_id)
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, f"original{ext}")
    with open(file_path, "wb") as f:
        f.write(file_content)

    # Create database record
    upload = Upload(
        id=upload_id,
        filename=file.filename,
        file_path=file_path,
        file_size=len(file_content),
        mime_type=file.content_type or "application/octet-stream",
        status=UploadStatus.PENDING
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    return upload
```

**Step 2: Create main.py FastAPI app**

Create `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import upload
from .database import Base, engine

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vision OCR API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router, prefix="/api", tags=["upload"])

@app.get("/")
def root():
    return {"message": "Vision OCR API"}
```

**Step 3: Test upload endpoint**

Run:
```bash
cd backend
uvicorn app.main:app --reload
```

Use curl or browser to test: `http://localhost:8000`

**Step 4: Commit**

Run:
```bash
git add backend/app/
git commit -m "feat: add file upload API endpoint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: List and Retrieve API Endpoints

**Files:**
- Modify: `backend/app/api/upload.py`

**Step 1: Add GET /api/uploads endpoint**

Add to `backend/app/api/upload.py`:
```python
from typing import List
from fastapi import Query

@router.get("/uploads", response_model=List[UploadResponse])
def list_uploads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[UploadStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Upload)
    if status:
        query = query.filter(Upload.status == status)
    uploads = query.order_by(Upload.uploaded_at.desc()).offset(skip).limit(limit).all()
    return uploads
```

**Step 2: Add GET /api/uploads/{upload_id} endpoint**

Add to `backend/app/api/upload.py`:
```python
from ..schemas import UploadDetail

@router.get("/uploads/{upload_id}", response_model=UploadDetail)
def get_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload
```

**Step 3: Add GET /api/uploads/{upload_id}/status endpoint**

Add to `backend/app/api/upload.py`:
```python
from ..schemas import StatusResponse

@router.get("/uploads/{upload_id}/status", response_model=StatusResponse)
def get_upload_status(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return StatusResponse(status=upload.status)
```

**Step 4: Commit**

Run:
```bash
git add backend/app/api/upload.py
git commit -m "feat: add list and retrieve API endpoints

Co-Authored-By: Claude <noreply@anthropic.com>"
```

