"""
Kirish so'rovnomasi (onboarding): yangi o'quvchi profilini yaratadi va qisqa
kirish testini baholaydi.

Kirish testi savollari ataylab statik (AI generatsiya qilmaydi): har bir
foydalanuvchi bir xil, oldindan tekshirilgan savollarni oladi, javobi esa
faqat serverda baholanadi. Natija `test_results`ga `topic_breakdown` bilan
yoziladi — shu orqali Weakness Radar birinchi kundanoq to'ladi.
"""
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.database import TestResult, User
from app.models.schemas import OnboardingIn
from app.services.weakness_service import recalculate_radar

PLACEMENT_QUESTIONS: list[dict] = [
    {
        "id": "k1",
        "subject": "kimyo",
        "category": "Umumiy kimyo",
        "question": "36 g suv ($H_2O$) necha mol bo'ladi?",
        "options": ["1 mol", "2 mol", "3 mol", "0,5 mol"],
        "correct_index": 1,
    },
    {
        "id": "k2",
        "subject": "kimyo",
        "category": "Umumiy kimyo",
        "question": "200 g 10% li $NaCl$ eritmasida necha gramm tuz erigan?",
        "options": ["10 g", "20 g", "2 g", "180 g"],
        "correct_index": 1,
    },
    {
        "id": "k3",
        "subject": "kimyo",
        "category": "Anorganik kimyo",
        "question": "Quyidagi moddalardan qaysi biri ion bog'lanishli?",
        "options": ["$H_2O$", "$CH_4$", "$O_2$", "$NaCl$"],
        "correct_index": 3,
    },
    {
        "id": "k4",
        "subject": "kimyo",
        "category": "Anorganik kimyo",
        "question": (
            "$Al + O_2 \\rightarrow Al_2O_3$ reaksiyasi tenglashtirilganda "
            "alyuminiy oldidagi koeffitsiyent nechaga teng?"
        ),
        "options": ["2", "3", "4", "6"],
        "correct_index": 2,
    },
    {
        "id": "k5",
        "subject": "kimyo",
        "category": "Organik kimyo",
        "question": "Alkanlarning umumiy formulasi qaysi?",
        "options": ["$C_nH_{2n}$", "$C_nH_{2n-2}$", "$C_nH_{2n-6}$", "$C_nH_{2n+2}$"],
        "correct_index": 3,
    },
    {
        "id": "b1",
        "subject": "biologiya",
        "category": "Hujayra biologiyasi",
        "question": "Hujayrada ATF asosan qaysi organoidda sintezlanadi?",
        "options": ["Ribosoma", "Golji apparati", "Lizosoma", "Mitoxondriya"],
        "correct_index": 3,
    },
    {
        "id": "b2",
        "subject": "biologiya",
        "category": "Hujayra biologiyasi",
        "question": (
            "Oqsil molekulasi 100 ta aminokislotadan iborat. Uni kodlovchi i-RNKning "
            "kodlovchi qismida (stop-kodonsiz) nechta nukleotid bor?"
        ),
        "options": ["100", "200", "300", "600"],
        "correct_index": 2,
    },
    {
        "id": "b3",
        "subject": "biologiya",
        "category": "Genetika",
        "question": "DNK molekulasida adenin nukleotidlari 20% ni tashkil etadi. Guanin nukleotidlari necha foiz?",
        "options": ["20%", "30%", "40%", "60%"],
        "correct_index": 1,
    },
    {
        "id": "b4",
        "subject": "biologiya",
        "category": "Genetika",
        "question": (
            "To'liq dominantlikda $Aa \\times Aa$ chatishtirilganda avlodda fenotip "
            "bo'yicha ajralish qanday bo'ladi?"
        ),
        "options": ["1 : 2 : 1", "3 : 1", "1 : 1", "9 : 3 : 3 : 1"],
        "correct_index": 1,
    },
    {
        "id": "b5",
        "subject": "biologiya",
        "category": "Botanika",
        "question": "Gulli o'simliklarda qo'sh urug'lanishni kim kashf etgan?",
        "options": ["G. Mendel", "Ch. Darvin", "S. G. Navashin", "I. V. Michurin"],
        "correct_index": 2,
    },
]


class PhoneAlreadyRegisteredError(Exception):
    """Bu telefon raqam bilan akkaunt allaqachon mavjud."""


def expand_subjects(choice: str) -> list[str]:
    return ["kimyo", "biologiya"] if choice == "ikkalasi" else [choice]


def get_placement_questions(subjects: list[str]) -> list[dict]:
    """Javob kalitisiz savollar — `correct_index` frontendga hech qachon yuborilmaydi."""
    return [
        {key: value for key, value in question.items() if key != "correct_index"}
        for question in PLACEMENT_QUESTIONS
        if question["subject"] in subjects
    ]


def grade_placement(subject: str, answers: dict[str, int]) -> dict:
    """Bitta fan bo'yicha javoblarni baholaydi. Javob berilmagan savol — xato hisoblanadi."""
    breakdown: dict[str, dict[str, int]] = defaultdict(lambda: {"correct": 0, "total": 0})
    correct = 0
    total = 0
    for question in PLACEMENT_QUESTIONS:
        if question["subject"] != subject:
            continue
        entry = breakdown[question["category"]]
        entry["total"] += 1
        total += 1
        if answers.get(question["id"]) == question["correct_index"]:
            entry["correct"] += 1
            correct += 1
    return {"correct": correct, "total": total, "topic_breakdown": dict(breakdown)}


async def complete_onboarding(db: AsyncSession, payload: OnboardingIn) -> tuple[User, list[dict]]:
    """Profilni yaratadi, kirish testini saqlaydi va radarni hisoblaydi."""
    if (await db.execute(select(User.id).where(User.phone == payload.phone))).first():
        raise PhoneAlreadyRegisteredError

    user = User(
        full_name=payload.full_name,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        current_grade=11 if payload.is_graduate else payload.current_grade,
        is_graduate=payload.is_graduate,
        subjects=payload.subjects,
        target_exam=payload.target_exam,
        target_score=payload.target_score if payload.target_score is not None else 189,
        target_cert_level=payload.target_cert_level,
        target_university=payload.target_university or None,
        self_level=payload.self_level,
        exam_month=payload.exam_month.replace(day=1) if payload.exam_month else None,
        daily_study_minutes=payload.daily_study_minutes,
        onboarded_at=datetime.now(timezone.utc),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:  # parallel so'rovda xuddi shu raqam bir vaqtda band qilinsa
        await db.rollback()
        raise PhoneAlreadyRegisteredError from exc

    subjects = expand_subjects(payload.subjects)
    summary: list[dict] = []
    for subject in subjects:
        graded = grade_placement(subject, payload.placement_answers)
        db.add(
            TestResult(
                user_id=user.id,
                subject=subject,
                test_type="oraliq",
                score=graded["correct"],
                max_score=graded["total"],
                details={"source": "onboarding_placement", "topic_breakdown": graded["topic_breakdown"]},
            )
        )
        summary.append({"subject": subject, "correct": graded["correct"], "total": graded["total"]})

    await db.commit()
    await db.refresh(user)

    for subject in subjects:
        await recalculate_radar(db, user.id, subject)

    return user, summary
