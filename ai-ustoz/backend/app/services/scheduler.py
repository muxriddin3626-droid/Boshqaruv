"""
MODUL 7: Async Cron Tasks — Autonomous Research Agent va Innovation
Generator uchun davriy fon vazifalari.

APScheduler `AsyncIOScheduler` ishlatiladi — FastAPI'ning o'z event
loop'ida ishlaydi, kichik/o'rta yuklama uchun yetarli. Katta trafikda buni
Celery Beat kabi alohida worker'ga ko'chirish tavsiya etiladi (bitta
`uvicorn` processida bir nechta replika ishlasa, har biri alohida
schedulerga ega bo'lib qoladi va vazifalar takrorlanishi mumkin).
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.services import research_service

settings = get_settings()
logger = logging.getLogger("ai_ustoz.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _run_research_scan_job() -> None:
    async with AsyncSessionLocal() as db:
        try:
            logs = await research_service.run_research_scan(db)
            logger.info("Research scan tugadi: %d yangi yozuv", len(logs))
        except Exception:  # noqa: BLE001 — fon vazifasi butun ilovani yiqitmasligi kerak
            logger.exception("Research scan xato bilan tugadi")


async def _run_innovation_scan_job() -> None:
    async with AsyncSessionLocal() as db:
        try:
            innovations = await research_service.run_innovation_scan(db)
            logger.info("Innovation scan tugadi: %d yangi yozuv", len(innovations))
        except Exception:  # noqa: BLE001
            logger.exception("Innovation scan xato bilan tugadi")


def start_scheduler() -> None:
    """FastAPI lifespan startup'ida chaqiriladi. `RESEARCH_SCAN_ENABLED=false` bo'lsa hech narsa qilmaydi."""
    global _scheduler
    if not settings.research_scan_enabled or _scheduler is not None:
        return

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _run_research_scan_job,
        IntervalTrigger(hours=settings.research_scan_interval_hours),
        id="research_scan",
        replace_existing=True,
    )
    _scheduler.add_job(
        _run_innovation_scan_job,
        IntervalTrigger(hours=settings.innovation_scan_interval_hours),
        id="innovation_scan",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Autonomous research/innovation scheduler ishga tushdi")


def shutdown_scheduler() -> None:
    """FastAPI lifespan shutdown'ida chaqiriladi."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
