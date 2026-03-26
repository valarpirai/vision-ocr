import os
import uuid
import base64
import json
import shutil
from typing import Optional, List
from urllib.parse import quote
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Upload, UploadStatus, OCRResult
from ..schemas import UploadResponse, UploadDetail, StatusResponse
from ..config import settings
from ..rag import indexer as rag_indexer

router = APIRouter()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf", ".tiff", ".tif", ".md", ".txt"}


def reconstruct_ocr_result(upload_id: str, db: Session) -> dict:
    """Reconstruct OCR result from chunks."""
    chunks = db.query(OCRResult).filter(
        OCRResult.upload_id == upload_id
    ).order_by(OCRResult.chunk_order).all()

    if not chunks:
        raise HTTPException(status_code=404, detail="OCR result not found")

    # Concatenate chunks
    encoded_data = "".join(chunk.chunk_data for chunk in chunks)

    # Decode from base64
    decoded_data = base64.b64decode(encoded_data).decode("utf-8")

    # Parse JSON
    return json.loads(decoded_data)


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
    limit: int = Query(50, ge=1, le=200),
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


@router.get("/uploads/{upload_id}/file")
def get_upload_file(upload_id: str, db: Session = Depends(get_db)):
    """Serve the uploaded file."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if not os.path.exists(upload.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Determine media type
    media_type = upload.mime_type or "application/octet-stream"

    # Sanitize filename for HTTP header (ASCII-safe)
    # Replace non-ASCII characters with underscores
    safe_filename = upload.filename.encode('ascii', 'ignore').decode('ascii')
    if not safe_filename:
        safe_filename = "file" + os.path.splitext(upload.filename)[1]

    # For PDFs, images, and text files, serve inline (opens in browser)
    # For other files, serve as attachment (triggers download)
    if (media_type == "application/pdf" or
        media_type.startswith("image/") or
        media_type.startswith("text/")):
        return FileResponse(
            path=upload.file_path,
            media_type=media_type,
            headers={"Content-Disposition": f'inline; filename="{safe_filename}"'}
        )
    else:
        return FileResponse(
            path=upload.file_path,
            media_type=media_type,
            filename=safe_filename
        )


@router.delete("/uploads/{upload_id}", status_code=204)
def delete_upload(upload_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Delete an upload and all associated data (OCR chunks, ChromaDB vectors, file on disk)."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status == UploadStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="Cannot delete an upload that is currently processing")

    # Delete file from disk
    upload_dir = os.path.dirname(upload.file_path)
    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir, ignore_errors=True)

    db.delete(upload)
    db.commit()

    # Remove ChromaDB vectors in the background (slow — don't block the response)
    background_tasks.add_task(_delete_chroma_vectors, upload_id)


def _delete_chroma_vectors(upload_id: str):
    try:
        rag_indexer.delete_upload(upload_id)
    except Exception as e:
        print(f"Warning: failed to delete ChromaDB vectors for {upload_id}: {e}")


@router.post("/uploads/{upload_id}/retry")
def retry_upload(upload_id: str, db: Session = Depends(get_db)):
    """Retry processing for a failed upload."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status == UploadStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="Upload is already processing")

    if upload.status == UploadStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Upload already completed")

    # Reset status to pending and clear error message
    upload.status = UploadStatus.PENDING
    upload.error_message = None
    upload.processed_at = None

    # Delete existing OCR result chunks if any
    db.query(OCRResult).filter(OCRResult.upload_id == upload_id).delete()

    db.commit()
    db.refresh(upload)

    return {"message": "Upload queued for retry", "upload": upload}


@router.get("/uploads/{upload_id}/result")
def get_upload_result(upload_id: str, db: Session = Depends(get_db)):
    """Get reconstructed OCR result as JSON."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status == UploadStatus.PENDING:
        raise HTTPException(status_code=400, detail="OCR pending — waiting for worker")
    elif upload.status == UploadStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="OCR in progress")
    elif upload.status == UploadStatus.FAILED:
        raise HTTPException(status_code=400, detail=f"OCR failed: {upload.error_message}")

    result = reconstruct_ocr_result(upload_id, db)
    return result


@router.get("/uploads/{upload_id}/export/markdown")
def export_markdown(upload_id: str, db: Session = Depends(get_db)):
    """Export OCR result as Markdown file."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status != UploadStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"OCR not completed (status: {upload.status.value})")

    result = reconstruct_ocr_result(upload_id, db)

    # Extract markdown content from all pages
    pages = result.get("pages", [])
    if pages:
        # Concatenate content from all pages
        markdown_content = "\n\n---\n\n".join(
            f"# Page {page.get('page_number', i+1)}\n\n{page.get('content', '')}"
            for i, page in enumerate(pages)
        )
    else:
        # Fallback to raw JSON if no pages found
        markdown_content = json.dumps(result, indent=2)

    filename = f"{os.path.splitext(upload.filename)[0]}.md"
    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/uploads/{upload_id}/export/json")
def export_json(upload_id: str, db: Session = Depends(get_db)):
    """Export OCR result as JSON file."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    if upload.status != UploadStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"OCR not completed (status: {upload.status.value})")

    result = reconstruct_ocr_result(upload_id, db)

    filename = f"{os.path.splitext(upload.filename)[0]}.json"
    return Response(
        content=json.dumps(result, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
