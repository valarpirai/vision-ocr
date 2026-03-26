from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    upload_dir: str = "./uploads"
    worker_poll_interval: int = 5
    worker_timeout: int = 300
    max_file_size: int = 52428800  # 50MB

    # Ollama OCR configuration (minicpm-v)
    dots_ocr_url: str = "http://localhost:11434/v1/chat/completions"
    dots_ocr_model: str = "minicpm-v"
    dots_ocr_prompt_mode: str = "Extract all text from this document image. Preserve the layout, headings, tables, and structure. Output as structured markdown."

    # Ollama configuration
    ollama_base_url: str = "http://localhost:11434"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_llm_model: str = "llama3.2"

    # ChromaDB configuration
    chroma_persist_dir: str = "./chroma_db"

    # RAG configuration
    rag_n_results: int = 5
    rag_context_window: int = 10
    rag_max_distance: float = 0.7  # cosine distance threshold; chunks above this are discarded

    # CORS
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
