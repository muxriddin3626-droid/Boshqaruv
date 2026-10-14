"""
MODUL 4: Auto-PDF Konspekt Generator.

Har bir tayyorlangan darsdan so'ng (yoki istalgan vaqtda) o'quvchi bir tugma
bosish orqali o'sha kungi eng muhim formula, qoida va xatolarni PDF holida
yuklab olishi mumkin.

Oqim:
1. `chat_messages` jadvalidan so'nggi suhbat tarixi va `weak_spots`dan
   hal qilinmagan xatolar yig'iladi.
2. `openai_service.summarize_for_conspect()` shu xom matnni qisqa
   {"formulas": [...], "rules": [...], "mistakes": [...]} strukturasiga
   aylantiradi.
3. ReportLab shu struktura asosida PDF fayl (bayt oqimi) yasaydi.
"""
import io
import os
import uuid
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import ChatMessage, WeakSpot
from app.services.openai_service import summarize_for_conspect

RECENT_MESSAGE_LIMIT = 40
FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
UNICODE_FONT_NAME = "AIUstozUnicode"
_font_registration_checked = False
_resolved_font_name = "Helvetica"


def _resolve_body_font() -> str:
    """
    O'zbek lotin alifbosidagi maxsus belgilar (oʻ, gʻ kabi apostrofli harflar)
    to'g'ri chiqishi uchun Unicode TTF shrift kerak (masalan DejaVuSans.ttf).
    Fayl `app/assets/fonts/DejaVuSans.ttf` yo'lida topilsa, shu shrift
    ishlatiladi; topilmasa standart Helvetica'ga tushiladi (bu holda ba'zi
    maxsus belgilar noto'g'ri chiqishi mumkin — productionda shriftni
    albatta joylashtiring).
    """
    global _font_registration_checked, _resolved_font_name
    if _font_registration_checked:
        return _resolved_font_name

    font_path = os.path.join(FONT_DIR, "DejaVuSans.ttf")
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont(UNICODE_FONT_NAME, font_path))
        _resolved_font_name = UNICODE_FONT_NAME

    _font_registration_checked = True
    return _resolved_font_name


async def _gather_conversation_text(db: AsyncSession, user_id: uuid.UUID, subject: str) -> str:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id, ChatMessage.subject == subject)
        .order_by(ChatMessage.created_at.desc())
        .limit(RECENT_MESSAGE_LIMIT)
    )
    messages = list(reversed((await db.execute(stmt)).scalars().all()))
    return "\n".join(f"{message.role}: {message.content}" for message in messages)


async def _gather_weak_spots_text(db: AsyncSession, user_id: uuid.UUID, subject: str) -> str:
    stmt = select(WeakSpot).where(
        WeakSpot.user_id == user_id, WeakSpot.subject == subject, WeakSpot.resolved.is_(False)
    )
    weak_spots = (await db.execute(stmt)).scalars().all()
    if not weak_spots:
        return "Hozircha qayd etilgan doimiy xato yo'q."
    return "\n".join(f"- {ws.topic}: {ws.mistake_description}" for ws in weak_spots)


def _build_pdf_bytes(subject: str, lesson_title: str | None, summary: dict) -> bytes:
    font_name = _resolve_body_font()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "AIUstozTitle", parent=styles["Title"], fontName=font_name, textColor=colors.HexColor("#4c1d95")
    )
    heading_style = ParagraphStyle(
        "AIUstozHeading",
        parent=styles["Heading2"],
        fontName=font_name,
        textColor=colors.HexColor("#0e7490"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle("AIUstozBody", parent=styles["Normal"], fontName=font_name, leading=16)

    subject_label = "Kimyo" if subject == "kimyo" else "Biologiya"
    header_line = f"Fan: {subject_label}"
    if lesson_title:
        header_line += f" | Mavzu: {lesson_title}"

    story = [
        Paragraph("AI Ustoz — Dars konspekti", title_style),
        Paragraph(header_line, body_style),
        Paragraph(datetime.now(timezone.utc).strftime("Sana: %Y-%m-%d %H:%M UTC"), body_style),
        Spacer(1, 0.5 * cm),
    ]

    def add_section(section_title: str, items: list[str]) -> None:
        story.append(Paragraph(section_title, heading_style))
        if not items:
            story.append(Paragraph("Bu bo'limda ma'lumot topilmadi.", body_style))
            return
        story.append(
            ListFlowable(
                [ListItem(Paragraph(item, body_style)) for item in items],
                bulletType="bullet",
            )
        )

    add_section("Asosiy formulalar", summary.get("formulas", []))
    add_section("Yodda tutish kerak bo'lgan qoidalar", summary.get("rules", []))
    add_section("Sizning xatolaringiz (weak spots)", summary.get("mistakes", []))

    doc.build(story)
    return buffer.getvalue()


async def generate_lesson_conspect_pdf(
    db: AsyncSession, user_id: uuid.UUID, subject: str, lesson_title: str | None = None
) -> bytes:
    """Suhbat tarixi + weak_spots asosida PDF konspekt generatsiya qilib, bayt ko'rinishida qaytaradi."""
    conversation_text = await _gather_conversation_text(db, user_id, subject)
    weak_spots_text = await _gather_weak_spots_text(db, user_id, subject)

    if not conversation_text:
        summary = {"formulas": [], "rules": [], "mistakes": []}
    else:
        summary = await summarize_for_conspect(subject, conversation_text, weak_spots_text)

    return _build_pdf_bytes(subject, lesson_title, summary)
