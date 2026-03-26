import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import Conversation, ConversationMessage, MessageRole
from ..config import settings
from ..rag import retriever, llm

router = APIRouter()


# ---------- Schemas ----------

class ConversationListItem(BaseModel):
    id: str
    title: Optional[str]
    updated_at: datetime
    message_count: int

    class Config:
        from_attributes = True


class MessageSource(BaseModel):
    upload_id: str
    filename: str
    page_number: int


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[List[MessageSource]]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: str
    title: Optional[str]
    created_at: datetime
    messages: List[MessageOut]

    class Config:
        from_attributes = True


class AskRequest(BaseModel):
    question: str
    upload_ids: Optional[List[str]] = None


class AskResponse(BaseModel):
    answer: str
    sources: List[MessageSource]
    message_id: int


# ---------- Helpers ----------

def _parse_sources(sources_json: Optional[str]) -> List[MessageSource]:
    if not sources_json:
        return []
    try:
        return [MessageSource(**s) for s in json.loads(sources_json)]
    except Exception:
        return []


def _message_to_out(msg: ConversationMessage) -> MessageOut:
    return MessageOut(
        id=msg.id,
        role=msg.role.value,
        content=msg.content,
        sources=_parse_sources(msg.sources),
        created_at=msg.created_at,
    )


# ---------- Endpoints ----------

@router.post("/conversations", response_model=ConversationListItem, status_code=201)
def create_conversation(db: Session = Depends(get_db)):
    conv = Conversation()
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationListItem(
        id=conv.id,
        title=conv.title,
        updated_at=conv.updated_at,
        message_count=0,
    )


@router.get("/conversations", response_model=List[ConversationListItem])
def list_conversations(db: Session = Depends(get_db)):
    conversations = (
        db.query(Conversation)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [
        ConversationListItem(
            id=c.id,
            title=c.title,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        )
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        messages=[_message_to_out(m) for m in conv.messages],
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()


@router.post("/conversations/{conversation_id}/messages", response_model=AskResponse)
def ask_question(
    conversation_id: str,
    request: AskRequest,
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Build conversation history for LLM context (last N turns)
    prior_messages = conv.messages[-settings.rag_context_window:]
    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in prior_messages
    ]

    # Rewrite follow-up questions into standalone questions for better retrieval
    retrieval_query = llm.rewrite_query(request.question, history)

    # Retrieve relevant chunks using the (possibly rewritten) query
    try:
        chunks = retriever.search(retrieval_query, request.upload_ids)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Generate answer using the original question (not the rewritten one)
    try:
        answer = llm.generate_answer(request.question, chunks, history)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Deduplicate sources
    seen = set()
    sources = []
    for chunk in chunks:
        key = (chunk["upload_id"], chunk["page_number"])
        if key not in seen:
            seen.add(key)
            sources.append(MessageSource(
                upload_id=chunk["upload_id"],
                filename=chunk["filename"],
                page_number=chunk["page_number"],
            ))

    sources_json = json.dumps([s.model_dump() for s in sources])

    # Persist user message
    user_msg = ConversationMessage(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=request.question,
    )
    db.add(user_msg)

    # Persist assistant message
    assistant_msg = ConversationMessage(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=answer,
        sources=sources_json,
    )
    db.add(assistant_msg)

    # Auto-title conversation from first question
    if conv.title is None:
        conv.title = request.question[:60] + ("..." if len(request.question) > 60 else "")

    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assistant_msg)

    return AskResponse(answer=answer, sources=sources, message_id=assistant_msg.id)
