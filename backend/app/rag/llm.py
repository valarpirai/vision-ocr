from typing import List, Dict, Any
import requests
from ..config import settings


def build_system_prompt(chunks: List[Dict[str, Any]]) -> str:
    if not chunks:
        context = "No relevant document context found."
    else:
        parts = []
        for chunk in chunks:
            parts.append(
                f"[{chunk['filename']}, page {chunk['page_number']}]:\n{chunk['content']}"
            )
        context = "\n\n---\n\n".join(parts)

    return (
        "You are a helpful document assistant. "
        "Answer the user's question based ONLY on the provided document context. "
        "If the answer is not in the context, say you don't have enough information in the provided documents. "
        "Always be concise and accurate.\n\n"
        f"Document context:\n\n{context}"
    )


def generate_answer(
    question: str,
    chunks: List[Dict[str, Any]],
    conversation_history: List[Dict[str, str]],
) -> str:
    """
    Generate an answer using Ollama llama3.2 with retrieved context and conversation history.
    """
    system_prompt = build_system_prompt(chunks)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": question})

    try:
        response = requests.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_llm_model,
                "messages": messages,
                "stream": False,
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot connect to Ollama at {settings.ollama_base_url}. "
            "Make sure Ollama is running."
        )
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama LLM error: {str(e)}")
