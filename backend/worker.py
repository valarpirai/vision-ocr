import time
import base64
import json
import os
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Upload, UploadStatus, OCRResult
from app.config import settings


CHUNK_SIZE = 1024  # bytes


def process_with_dots_ocr(file_path: str) -> dict:
    """
    Process file with dots.ocr and return structured result.

    TODO: Integrate actual dots.ocr library here.
    For now, returns a mock result.
    """
    # Mock implementation - replace with actual dots.ocr call
    mock_result = {
        "file": file_path,
        "pages": [
            {
                "page_number": 1,
                "text": "Sample OCR text extracted from document",
                "markdown": "# Sample Document\n\nThis is extracted text.",
                "elements": [
                    {"type": "text", "content": "Sample text", "bbox": [0, 0, 100, 20]},
                    {"type": "heading", "content": "Sample Heading", "bbox": [0, 30, 200, 50]}
                ]
            }
        ],
        "metadata": {
            "total_pages": 1,
            "processing_time": 1.5
        }
    }

    # Simulate processing time
    time.sleep(2)

    return mock_result


def chunk_and_store_result(upload_id: str, result: dict, db: Session):
    """Encode result as base64, split into chunks, and store in database."""
    # Convert result to JSON string
    json_str = json.dumps(result)

    # Encode as base64
    encoded = base64.b64encode(json_str.encode("utf-8")).decode("utf-8")

    # Split into chunks
    chunks = [encoded[i:i+CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
    total_chunks = len(chunks)

    # Store chunks
    for order, chunk_data in enumerate(chunks):
        ocr_result = OCRResult(
            upload_id=upload_id,
            chunk_order=order,
            chunk_data=chunk_data
        )
        db.add(ocr_result)

    return total_chunks


def process_upload(upload: Upload, db: Session):
    """Process a single upload."""
    try:
        print(f"Processing upload {upload.id}: {upload.filename}")

        # Update status to processing
        upload.status = UploadStatus.PROCESSING
        db.commit()

        # Process with dots.ocr
        result = process_with_dots_ocr(upload.file_path)

        # Store chunks
        total_chunks = chunk_and_store_result(upload.id, result, db)

        # Update upload record
        upload.status = UploadStatus.COMPLETED
        upload.processed_at = datetime.utcnow()
        upload.total_chunks = total_chunks
        db.commit()

        print(f"Completed upload {upload.id}")

    except Exception as e:
        print(f"Error processing upload {upload.id}: {str(e)}")
        upload.status = UploadStatus.FAILED
        upload.error_message = str(e)
        db.commit()


def worker_loop():
    """Main worker loop."""
    print(f"Worker started. Polling interval: {settings.worker_poll_interval}s")

    while True:
        db = SessionLocal()
        try:
            # Find pending upload with row locking
            upload = db.query(Upload).filter(
                Upload.status == UploadStatus.PENDING
            ).with_for_update(skip_locked=True).first()

            if upload:
                process_upload(upload, db)
            else:
                # No pending uploads, sleep
                time.sleep(settings.worker_poll_interval)

        except Exception as e:
            print(f"Worker error: {str(e)}")
            time.sleep(settings.worker_poll_interval)
        finally:
            db.close()


if __name__ == "__main__":
    # Ensure uploads directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Start worker loop
    worker_loop()
