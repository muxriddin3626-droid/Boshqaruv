"""AI Ustoz — FastAPI ilova kirish nuqtasi."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, conspect, flashcards, progress, sync, voice, weakness
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="AI Ustoz API",
    description="DTM (BMBA) va Milliy Sertifikat imtihonlariga tayyorlovchi AI repetitor backend xizmati.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(progress.router)
app.include_router(flashcards.router)
app.include_router(weakness.router)
app.include_router(conspect.router)
app.include_router(sync.router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "service": "ai-ustoz-backend"}
