from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./app.db"
    upload_dir: str = "./uploads"
    worker_poll_interval: int = 5
    worker_timeout: int = 300
    max_file_size: int = 52428800  # 50MB

    class Config:
        env_file = ".env"


settings = Settings()
