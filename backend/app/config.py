from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    upload_dir: str = "./uploads"
    worker_poll_interval: int = 5
    worker_timeout: int = 300
    max_file_size: int = 52428800  # 50MB

    # dots.ocr configuration
    dots_ocr_url: str = "http://localhost:8001/v1/chat/completions"
    dots_ocr_model: str = "rednote-hilab/dots.ocr"
    dots_ocr_prompt_mode: str = "prompt_layout_all_en"

    class Config:
        env_file = ".env"


settings = Settings()
