from typing import List
import requests
from ..config import settings


def embed(text: str) -> List[float]:
    """Generate embedding for text using Ollama nomic-embed-text."""
    try:
        response = requests.post(
            f"{settings.ollama_base_url}/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["embedding"]
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot connect to Ollama at {settings.ollama_base_url}. "
            "Make sure Ollama is running."
        )
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama embedding error: {str(e)}")
