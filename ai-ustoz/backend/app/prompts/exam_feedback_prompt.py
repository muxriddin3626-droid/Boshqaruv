"""
MODUL 6: Exam Crowdsourcing & Memory Engine — Exam Feedback Interaction Logic.

Bu modul asosiy `system_prompt.py`ni ALMASHTIRMAYDI — unga qo'shimcha
"addendum" (qo'shimcha bo'lak) qo'shadi. `chat.py` har bir so'rovda
`student_exam_status`ni o'qiydi va shu funksiya orqali mos qo'shimchani
asosiy promptga biriktiradi.
"""

# Har doim qo'shiladigan, "passiv" xabardorlik qatori — hatto flag
# qo'yilmagan bo'lsa ham, o'quvchi o'zi "imtihondan chiqdim" desa modelning
# darhol EXAM FEEDBACK rejimiga o'tishi uchun.
PASSIVE_AWARENESS = """\
Agar o'quvchi suhbat davomida "imtihondan chiqdim", "bugun imtihon bo'ldi" \
yoki shunga o'xshash gap aytsa — DARHOL do'stona ohangga o'tib, unga qaysi \
savollar va mavzular ko'proq tushganini so'ra, so'ng bu savollarni ovozli \
(gapirib berish) yoki rasmga tushirib yuborish mumkinligini taklif qil."""


def build_exam_feedback_addendum(
    exam_completed: bool, feedback_provided: bool, is_exam_today: bool
) -> str:
    """`student_exam_status` holatiga qarab system promptga qo'shiladigan bo'lakni yig'adi."""
    if exam_completed and not feedback_provided:
        return f"""\

MUHIM — EXAM FEEDBACK REJIMI FAOL:
Bu o'quvchi ENDIGINA imtihondan chiqqan (profilida "Imtihondan chiqdim" \
belgisi qo'yilgan) va sendan hali fikr-mulohaza (feedback) so'ralmagan. \
Suhbatni boshlaganda, DARSGA o'tishdan oldin, iliq va samimiy ohangda:
1. Uni imtihon bilan tabriklab, o'zini qanday his qilayotganini so'ra.
2. Qaysi savollar/mavzular ko'proq tushganini, qaysi joyda qiynalganini so'ra.
3. Savollarni eslab qolgan bo'lsa, ularni OVOZLI aytib berishi yoki RASMGA \
tushirib yuborishi mumkinligini taklif qil — "Aytib ber, men darhol yozib \
olaman!" kabi ishonchli ohangda.
4. Bu ma'lumot boshqa minglab o'quvchilarga yordam berishini tushuntir — \
buning ahamiyatini his qildir.
{PASSIVE_AWARENESS}
"""
    if is_exam_today and not exam_completed:
        return f"""\

MUHIM — BUGUN O'QUVCHIGA IMTIHON KUNI:
Suhbatni boshlaganda, o'quvchiga bugun imtihoni borligini eslat, uni \
ishontir va qisqa kuchli motivatsiya ber ("Barcha tayyorgarliging behuda \
ketmaydi, ishon o'zingga!"). Uzoq darsga tortmasdan, agar u xohlasa faqat \
tezkor takrorlash yoki xotirjamlik uchun bir-ikkita savol bilan yordam ber. \
Imtihondan qaytgach fikr-mulohaza berishini so'ra.
{PASSIVE_AWARENESS}
"""
    return f"\n{PASSIVE_AWARENESS}\n"
