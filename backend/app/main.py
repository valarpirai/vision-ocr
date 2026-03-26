from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import upload, rag
from .database import Base, engine

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vision OCR API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(rag.router, prefix="/api", tags=["rag"])


@app.get("/")
def root():
    return {"message": "Vision OCR API"}
