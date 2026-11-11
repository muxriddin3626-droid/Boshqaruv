"""
Fanlar bo'yicha mavzular katalogi va test formatlari.

Har bir mavzu yirik bo'limga (category) tegishli — Weakness Radar o'qlari
shu bo'limlar, mavzu testi esa mayda mavzular bo'yicha tanlanadi.
"""
from dataclasses import dataclass

SUBJECT_TOPICS: dict[str, list[tuple[str, str]]] = {
    "kimyo": [
        ("Umumiy kimyo", "Kimyo fani: moddalar va hodisalar"),
        ("Umumiy kimyo", "Atom, molekula va kimyoviy element"),
        ("Umumiy kimyo", "Kimyoviy formula va valentlik"),
        ("Umumiy kimyo", "Kimyoviy reaksiya tenglamalari"),
        ("Umumiy kimyo", "Atom tuzilishi va davriy qonun"),
        ("Umumiy kimyo", "Kimyoviy bog'lanish"),
        ("Umumiy kimyo", "Mol va stexiometriya"),
        ("Umumiy kimyo", "Gaz qonunlari"),
        ("Umumiy kimyo", "Eritmalar va konsentratsiya"),
        ("Umumiy kimyo", "Kimyoviy kinetika va muvozanat"),
        ("Umumiy kimyo", "Oksidlanish-qaytarilish reaksiyalari"),
        ("Anorganik kimyo", "Anorganik birikmalar sinflari"),
        ("Anorganik kimyo", "Elektrolitik dissotsiatsiya"),
        ("Anorganik kimyo", "Metallar"),
        ("Anorganik kimyo", "Metallmaslar"),
        ("Organik kimyo", "Uglevodorodlar"),
        ("Organik kimyo", "Kislorodli organik birikmalar"),
        ("Organik kimyo", "Azotli organik birikmalar va oqsillar"),
    ],
    "biologiya": [
        ("Botanika", "O'simlik hujayrasi va to'qimalari"),
        ("Botanika", "O'simlik organlari"),
        ("Botanika", "O'simliklar sistematikasi"),
        ("Zoologiya", "Umurtqasiz hayvonlar"),
        ("Zoologiya", "Umurtqali hayvonlar"),
        ("Odam anatomiyasi", "Tayanch-harakat va qon aylanish sistemasi"),
        ("Odam anatomiyasi", "Nafas olish, hazm qilish va ayirish"),
        ("Odam anatomiyasi", "Nerv va endokrin sistema"),
        ("Hujayra biologiyasi", "Hujayra tuzilishi"),
        ("Hujayra biologiyasi", "Moddalar va energiya almashinuvi"),
        ("Hujayra biologiyasi", "Oqsil biosintezi"),
        ("Hujayra biologiyasi", "Hujayra bo'linishi"),
        ("Genetika", "DNK va RNK"),
        ("Genetika", "Mendel qonunlari"),
        ("Genetika", "Irsiyat va o'zgaruvchanlik"),
        ("Evolyutsiya va ekologiya", "Evolyutsiya"),
        ("Evolyutsiya va ekologiya", "Ekologiya"),
    ],
}


def topics_for(subject: str) -> list[tuple[str, str]]:
    return SUBJECT_TOPICS[subject]


def category_of(subject: str, topic: str) -> str | None:
    return next((category for category, name in SUBJECT_TOPICS[subject] if name == topic), None)


# DTM test tizimi: ixtisoslik fanlari 30 tadan savol, 1-fan har savoli 3,1 ball,
# 2-fan 2,1 ball (majburiy fanlar bilan birga maksimal 189 ball). Haqiqiy
# imtihonda 90 savolga 3 soat beriladi — shu sur'at (2 daqiqa/savol) olinadi.
DTM_QUESTIONS_PER_SUBJECT = 30
DTM_FIRST_SUBJECT_WEIGHT = 3.1
DTM_SECOND_SUBJECT_WEIGHT = 2.1
DTM_SECONDS_PER_QUESTION = 120


@dataclass(frozen=True)
class MilliySertifikatFormat:
    """
    Milliy Sertifikat formati RASMIY HUJJATDAN tasdiqlanmagan. Savollar soni va
    vaqt mashq uchun taxminiy; daraja chegaralari (A+, A, B+...) tasdiqlanmaguncha
    `level_thresholds` bo'sh qoladi va o'quvchiga daraja emas, faqat foiz ko'rsatiladi
    (aks holda noto'g'ri daraja ko'rsatib qo'yamiz).
    """

    question_count: int = 30
    seconds_per_question: int = 120
    # Masalan: (("A+", 90.0), ("A", 80.0), ...) — eng yuqoridan pastga, foiz bo'yicha
    level_thresholds: tuple[tuple[str, float], ...] = ()
    is_official: bool = False


MS_FORMAT = MilliySertifikatFormat()


def ms_level_for(percent: float) -> str | None:
    for level, minimum in MS_FORMAT.level_thresholds:
        if percent >= minimum:
            return level
    return None
