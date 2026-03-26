from typing import List, Optional, Dict, Any
from . import embedder, chroma_client
from ..config import settings


def search(
    query: str,
    upload_ids: Optional[List[str]] = None,
    n_results: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Semantic search over indexed documents.
    Returns list of matching chunks with metadata.
    """
    collection = chroma_client.get_collection()

    if collection.count() == 0:
        return []

    n = n_results or settings.rag_n_results
    query_embedding = embedder.embed(query)

    where = None
    if upload_ids:
        if len(upload_ids) == 1:
            where = {"upload_id": upload_ids[0]}
        else:
            where = {"upload_id": {"$in": upload_ids}}

    query_kwargs: Dict[str, Any] = {
        "query_embeddings": [query_embedding],
        "n_results": min(n, collection.count()),
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        query_kwargs["where"] = where

    results = collection.query(**query_kwargs)

    chunks = []
    for i, doc_id in enumerate(results["ids"][0]):
        distance = results["distances"][0][i]
        if distance > settings.rag_max_distance:
            continue  # discard low-relevance chunks to reduce hallucination risk

        metadata = results["metadatas"][0][i]
        chunks.append({
            "id": doc_id,
            "upload_id": metadata["upload_id"],
            "filename": metadata["filename"],
            "page_number": metadata["page_number"],
            "chunk_index": metadata.get("chunk_index", 0),
            "chunk_type": metadata.get("chunk_type", "paragraph"),
            "content": results["documents"][0][i],
            "distance": distance,
        })

    return chunks
