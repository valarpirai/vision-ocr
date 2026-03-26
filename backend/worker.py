import time
import base64
import json
import os
import signal
from datetime import datetime
from io import BytesIO
from typing import List
import requests
from PIL import Image
from pdf2image import convert_from_path
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Upload, UploadStatus, OCRResult
from app.config import settings
from app.rag import indexer as rag_indexer

_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    print(f"Received signal {signum}, shutting down after current job...")
    _shutdown = True


CHUNK_SIZE = 1024  # bytes
TEXT_FILE_EXTENSIONS = {".md", ".txt"}


def is_text_file(file_path: str) -> bool:
    """Check if file is a text file (markdown or plain text)."""
    ext = os.path.splitext(file_path)[1].lower()
    return ext in TEXT_FILE_EXTENSIONS


def process_text_file(file_path: str) -> dict:
    """
    Process text file (markdown or plain text) by reading content directly.
    Returns same structure as OCR result for consistency.
    """
    start_time = time.time()

    # Read text content
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    processing_time = time.time() - start_time

    # Format as single-page result (matching OCR structure)
    result = {
        "file": file_path,
        "pages": [
            {
                "page_number": 1,
                "content": content,
                "raw_response": {
                    "type": "text_file",
                    "message": "Text file processed without OCR"
                }
            }
        ],
        "metadata": {
            "total_pages": 1,
            "processing_time": processing_time,
            "source_type": "text_file"
        }
    }

    return result


def encode_image_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64 string."""
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def load_images_from_file(file_path: str) -> List[Image.Image]:
    """Load images from file (supports images and PDFs)."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        # Convert PDF to images
        images = convert_from_path(file_path)
        return images
    else:
        # Load single image
        image = Image.open(file_path)
        return [image]


def call_dots_ocr_api(image_base64: str, page_number: int) -> dict:
    """Call dots.ocr vLLM API for a single image."""
    payload = {
        "model": settings.dots_ocr_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": settings.dots_ocr_prompt_mode
                    }
                ]
            }
        ],
        "max_tokens": 4096,
        "temperature": 0
    }

    try:
        response = requests.post(
            settings.dots_ocr_url,
            json=payload,
            timeout=settings.worker_timeout
        )
        response.raise_for_status()

        result = response.json()

        # Extract content from vLLM response
        content = result["choices"][0]["message"]["content"]

        return {
            "page_number": page_number,
            "content": content,
            "raw_response": result
        }

    except requests.exceptions.RequestException as e:
        raise Exception(f"dots.ocr API error: {str(e)}")


def process_with_dots_ocr(file_path: str) -> dict:
    """
    Process file with dots.ocr and return structured result.
    """
    start_time = time.time()

    # Load images from file
    images = load_images_from_file(file_path)

    # Process each page
    pages = []
    for idx, image in enumerate(images, start=1):
        print(f"Processing page {idx}/{len(images)}...")

        # Encode image
        image_base64 = encode_image_to_base64(image)

        # Call API
        page_result = call_dots_ocr_api(image_base64, idx)
        pages.append(page_result)

    processing_time = time.time() - start_time

    result = {
        "file": file_path,
        "pages": pages,
        "metadata": {
            "total_pages": len(pages),
            "processing_time": processing_time
        }
    }

    return result


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

        # Check if text file (skip OCR)
        if is_text_file(upload.file_path):
            print(f"Text file detected, skipping OCR")
            result = process_text_file(upload.file_path)
        else:
            # Process with OCR
            result = process_with_dots_ocr(upload.file_path)

        # Store chunks
        total_chunks = chunk_and_store_result(upload.id, result, db)

        # Update upload record
        upload.status = UploadStatus.COMPLETED
        upload.processed_at = datetime.utcnow()
        upload.total_chunks = total_chunks
        db.commit()

        print(f"Completed upload {upload.id}")

        # Auto-index into ChromaDB for RAG (non-fatal if it fails)
        try:
            indexed_count = rag_indexer.index_upload(upload.id, upload.filename, result)
            upload.indexed_at = datetime.utcnow()
            db.commit()
            print(f"Indexed {indexed_count} page(s) for upload {upload.id}")
        except Exception as index_err:
            print(f"Warning: RAG indexing failed for upload {upload.id}: {str(index_err)}")

    except Exception as e:
        print(f"Error processing upload {upload.id}: {str(e)}")
        upload.status = UploadStatus.FAILED
        upload.error_message = str(e)
        db.commit()


def worker_loop():
    """Main worker loop."""
    print(f"Worker started. Polling interval: {settings.worker_poll_interval}s")

    while not _shutdown:
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
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Ensure uploads directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    worker_loop()
    print("Worker stopped.")
