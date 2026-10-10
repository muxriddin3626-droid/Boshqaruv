"""
O'quv dasturi: har bir mavzu maktabda nechanchi sinfda o'tilishi va DTM darajasida
o'zlashtirish uchun taxminan necha soat kerakligi (nazariya + masala).

Tartib — maktab dasturi tartibi (poydevordan murakkabga). Sinf raqamlari va
soatlar TAXMINIY: o'zbek maktab darsliklari bo'yicha o'qituvchi tekshirib
chiqishi kerak. Mavzular to'plami `quiz_catalog.SUBJECT_TOPICS` bilan bir xil
(testlar shuni tekshiradi) — reja mavzusi bo'yicha mavzu testi ham topiladi.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CurriculumTopic:
    subject: str
    category: str
    topic: str
    grade: int  # maktabda o'tiladigan sinf
    hours: float  # o'rta darajadagi o'quvchi uchun DTM darajasigacha


def _topics(subject: str, rows: list[tuple[str, str, int, float]]) -> list[CurriculumTopic]:
    return [CurriculumTopic(subject, category, topic, grade, hours) for category, topic, grade, hours in rows]


CURRICULUM: dict[str, list[CurriculumTopic]] = {
    "kimyo": _topics(
        "kimyo",
        [
            # Poydevor (7-sinf boshi): mol va masalalardan oldin shular tushunilishi shart.
            ("Umumiy kimyo", "Kimyo fani: moddalar va hodisalar", 7, 4),
            ("Umumiy kimyo", "Atom, molekula va kimyoviy element", 7, 5),
            ("Umumiy kimyo", "Kimyoviy formula va valentlik", 7, 6),
            ("Umumiy kimyo", "Kimyoviy reaksiya tenglamalari", 7, 6),
            ("Umumiy kimyo", "Mol va stexiometriya", 7, 12),
            ("Umumiy kimyo", "Gaz qonunlari", 7, 8),
            ("Umumiy kimyo", "Eritmalar va konsentratsiya", 7, 10),
            ("Anorganik kimyo", "Anorganik birikmalar sinflari", 8, 10),
            ("Umumiy kimyo", "Atom tuzilishi va davriy qonun", 8, 8),
            ("Umumiy kimyo", "Kimyoviy bog'lanish", 8, 6),
            ("Umumiy kimyo", "Oksidlanish-qaytarilish reaksiyalari", 8, 8),
            ("Anorganik kimyo", "Elektrolitik dissotsiatsiya", 9, 8),
            ("Umumiy kimyo", "Kimyoviy kinetika va muvozanat", 9, 8),
            ("Anorganik kimyo", "Metallmaslar", 9, 10),
            ("Anorganik kimyo", "Metallar", 9, 10),
            ("Organik kimyo", "Uglevodorodlar", 10, 12),
            ("Organik kimyo", "Kislorodli organik birikmalar", 10, 12),
            ("Organik kimyo", "Azotli organik birikmalar va oqsillar", 11, 8),
        ],
    ),
    "biologiya": _topics(
        "biologiya",
        [
            ("Botanika", "O'simlik hujayrasi va to'qimalari", 6, 5),
            ("Botanika", "O'simlik organlari", 6, 6),
            ("Botanika", "O'simliklar sistematikasi", 6, 6),
            ("Zoologiya", "Umurtqasiz hayvonlar", 7, 6),
            ("Zoologiya", "Umurtqali hayvonlar", 7, 6),
            ("Odam anatomiyasi", "Tayanch-harakat va qon aylanish sistemasi", 8, 7),
            ("Odam anatomiyasi", "Nafas olish, hazm qilish va ayirish", 8, 7),
            ("Odam anatomiyasi", "Nerv va endokrin sistema", 8, 7),
            ("Hujayra biologiyasi", "Hujayra tuzilishi", 9, 6),
            ("Hujayra biologiyasi", "Moddalar va energiya almashinuvi", 9, 8),
            ("Hujayra biologiyasi", "Oqsil biosintezi", 9, 8),
            ("Hujayra biologiyasi", "Hujayra bo'linishi", 9, 6),
            ("Genetika", "DNK va RNK", 10, 8),
            ("Genetika", "Mendel qonunlari", 10, 10),
            ("Genetika", "Irsiyat va o'zgaruvchanlik", 10, 8),
            ("Evolyutsiya va ekologiya", "Evolyutsiya", 11, 6),
            ("Evolyutsiya va ekologiya", "Ekologiya", 11, 5),
        ],
    ),
}


def curriculum_topic(subject: str, topic: str) -> CurriculumTopic | None:
    return next((item for item in CURRICULUM.get(subject, []) if item.topic == topic), None)
