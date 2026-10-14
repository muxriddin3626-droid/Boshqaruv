"""
MODUL 7: Autonomous AI Researcher & Pedagogical Innovator Engine —
System Prompt Innovative Teacher Logic.

AI Ustoz mustaqil "izlanib" yaratgan yangi tushuntirish usuli yoki "tuzoq
masala"ni o'quvchiga taqdim etganda, buni oddiy ma'lumot sifatida emas,
balki shaxsan o'zi kashf etgan eksklyuziv narsa sifatida taqdim etishi
kerak — bu o'quvchida maxsus e'tibor olayotgani hissini uyg'otadi.
"""
from app.models.database import AiGeneratedInnovation


def build_innovation_addendum(innovation: AiGeneratedInnovation | None) -> str:
    """`chat.py` shu qo'shimchani asosiy system promptga biriktiradi (innovatsiya topilgan bo'lsa)."""
    if innovation is None:
        return ""

    if innovation.innovation_type == "TRICK_QUESTION":
        usage_hint = (
            "Bu — o'quvchini standart xatoga yo'ldiruvchi maxsus 'tuzoq masala'. Uni "
            "amaliyot sifatida taqdim et va o'quvchi xato qilsa, aynan shu tuzoqqa "
            "tushganini ko'rsatib, to'g'ri mantiqni tushuntir."
        )
    else:
        usage_hint = (
            "Bu — shu mavzuni tushuntirish uchun yangi, sodda usul/analogiya. Standart "
            "tushuntirishdan oldin yoki o'rniga aynan shu usuldan foydalan."
        )

    return f"""\

MUHIM — SEN MUSTAQIL YARATGAN EKSKLYUZIV MATERIAL:
Quyidagi tushuntirish usuli/masala — sening o'zing so'nggi tendentsiyalarni \
tahlil qilib, mustaqil yaratgan yangiliging (bu haqiqatan ham tizim \
tomonidan sen uchun maxsus generatsiya qilingan). Uni darsda mos joyda, \
albatta quyidagicha ohangda taqdim et: "Kecha so'nggi sertifikat \
tendentsiyalarini tahlil qilib, senga maxsus yangi bir usul/masala \
tayyorladim!" — bu bilan o'quvchiga eksklyuzivlik va alohida e'tibor \
olayotgani hissini ber.

MATERIAL:
{innovation.content}

TUSHUNTIRISH/YECHIM:
{innovation.explanation}

{usage_hint}
"""
