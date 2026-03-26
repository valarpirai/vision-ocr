from typing import List
from datetime import datetime
from . import embedder, chroma_client
from .chunker import chunk_page

MIN_CONTENT_CHARS = 20  # skip pages/chunks with fewer characters than this


def index_upload(upload_id: str, filename: str, ocr_result: dict) -> int:
    """
    Index all pages of an OCR result into ChromaDB.
    Each page is split into sub-page chunks (table rows, paragraphs, kv groups)
    so retrieval is precise rather than blending an entire page into one vector.
    Returns total number of chunks indexed.
    """
    pages = ocr_result.get("pages", [])
    if not pages:
        return 0

    collection = chroma_client.get_collection()
    indexed_at = datetime.utcnow().isoformat()

    ids: List[str] = []
    embeddings: List[List[float]] = []
    documents: List[str] = []
    metadatas: List[dict] = []

    for page in pages:
        page_number = page.get("page_number", 1)
        content = page.get("content", "").strip()
        if len(content) < MIN_CONTENT_CHARS:
            continue  # skip blank or near-empty OCR pages

        chunks = chunk_page(content)
        if not chunks:
            continue

        for chunk in chunks:
            if len(chunk.content) < MIN_CONTENT_CHARS:
                continue  # skip fragments that survived the chunker merge
            doc_id = f"{upload_id}_page_{page_number}_chunk_{chunk.index}"
            embedding = embedder.embed(chunk.content)

            ids.append(doc_id)
            embeddings.append(embedding)
            documents.append(chunk.content)
            metadatas.append({
                "upload_id": upload_id,
                "filename": filename,
                "page_number": page_number,
                "chunk_index": chunk.index,
                "chunk_type": chunk.chunk_type,
                "indexed_at": indexed_at,
            })

    if ids:
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

    return len(ids)


def delete_upload(upload_id: str):
    """Remove all ChromaDB entries for a given upload."""
    collection = chroma_client.get_collection()
    results = collection.get(where={"upload_id": upload_id})
    if results["ids"]:
        collection.delete(ids=results["ids"])
