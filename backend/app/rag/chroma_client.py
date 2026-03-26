import chromadb
from chromadb.config import Settings as ChromaSettings
from ..config import settings

_client = None
_collection = None


def get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        client = get_client()
        _collection = client.get_or_create_collection(
            name="vision_ocr_docs",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection
