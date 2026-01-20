import os
import uuid
from typing import Optional
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
