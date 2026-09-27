"""AI Ustoz — FastAPI ilova kirish nuqtasi."""
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import audio, chat, conspect, exam_feedback, flashcards, progress, research, sync, voice, weakness
from app.core.config import get_settings
from app.services.scheduler import shutdown_scheduler, start_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    start_scheduler()  # Modul 7: RESEARCH_SCAN_ENABLED=true bo'lsagina fon vazifalarini boshlaydi
    yield
    shutdown_scheduler()


app = FastAPI(
    title="AI Ustoz API",
    description="DTM (BMBA) va Milliy Sertifikat imtihonlariga tayyorlovchi AI repetitor backend xizmati.",
    version="1.0.0",
    lifespan=lifespan,
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
app.include_router(exam_feedback.router)
app.include_router(research.router)
app.include_router(audio.router)


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "service": "ai-ustoz-backend"}
