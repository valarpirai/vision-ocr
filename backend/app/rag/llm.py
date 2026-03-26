import logging
from typing import List, Dict, Any
import requests
from ..config import settings

logger = logging.getLogger(__name__)


def _sort_chunks_by_document_order(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Re-sort retrieved chunks by (filename, page_number, chunk_index).
    ChromaDB returns chunks ranked by similarity, but LLMs handle context
    better when passages appear in their natural document order.
    """
    return sorted(
        chunks,
        key=lambda c: (c["filename"], c["page_number"], c.get("chunk_index", 0)),
    )


def build_system_prompt(chunks: List[Dict[str, Any]]) -> str:
    ordered = _sort_chunks_by_document_order(chunks)
    if not ordered:
        context = "No relevant document context found."
    else:
        parts = []
        for chunk in ordered:
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


def rewrite_query(question: str, conversation_history: List[Dict[str, str]]) -> str:
    """
    Rewrite a follow-up question into a standalone question using conversation history.

    Example:
      history:  User: "What is the invoice total?"  Assistant: "$1,700"
      question: "What about the tax?"
      rewritten: "What is the tax amount on the invoice?"

    If there is no history, returns the original question unchanged.
    Falls back to the original question on any Ollama error.
    """
    if not conversation_history:
        return question

    history_text = "\n".join(
        f"{msg['role'].capitalize()}: {msg['content']}"
        for msg in conversation_history[-6:]  # last 3 turns is enough context
    )

    prompt = (
        "Given the conversation history below, rewrite the follow-up question "
        "as a complete, standalone question that can be understood without the history. "
        "Output ONLY the rewritten question — no explanation, no quotes.\n\n"
        f"Conversation history:\n{history_text}\n\n"
        f"Follow-up question: {question}\n\n"
        "Standalone question:"
    )

    try:
        response = requests.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": settings.ollama_llm_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
            timeout=30,
        )
        response.raise_for_status()
        rewritten = response.json()["message"]["content"].strip()
        # Sanity check: if the model returns something too short or empty, use original
        if len(rewritten) <= 5:
            logger.warning("Query rewrite returned too-short result %r, using original", rewritten)
            return question
        return rewritten
    except Exception as e:
        logger.warning("Query rewrite failed (%s), falling back to original question", e)
        return question


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
