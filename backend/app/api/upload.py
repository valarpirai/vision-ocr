import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload, UploadStatus
from ..schemas import UploadResponse, UploadDetail, StatusResponse
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


@router.get("/uploads/{upload_id}", response_model=UploadDetail)
def get_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return upload


@router.get("/uploads/{upload_id}/status", response_model=StatusResponse)
def get_upload_status(upload_id: str, db: Session = Depends(get_db)):
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    return StatusResponse(status=upload.status)
