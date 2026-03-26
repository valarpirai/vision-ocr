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
    indexed_at: Optional[datetime]
    total_chunks: Optional[int]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class StatusResponse(BaseModel):
    status: UploadStatus
    progress: Optional[int] = None
