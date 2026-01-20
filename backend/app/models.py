import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class UploadStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Upload(Base):
    __tablename__ = "uploads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
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
