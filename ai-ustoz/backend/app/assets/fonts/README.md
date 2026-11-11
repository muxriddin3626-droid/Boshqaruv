# Shrift papkasi (PDF konspekt uchun)

`pdf_service.py` shu papkadan `DejaVuSans.ttf` faylini qidiradi — bu shrift
o'zbek lotin alifbosidagi maxsus belgilarni (`oʻ`, `gʻ` kabi apostrofli
harflarni) to'g'ri render qilish uchun kerak.

Fayl topilmasa, kod avtomatik ravishda standart `Helvetica` shriftiga
tushadi (PDF baribir generatsiya bo'ladi, lekin ba'zi maxsus belgilar
noto'g'ri chiqishi mumkin).

## O'rnatish

1. [DejaVu Sans](https://dejavu-fonts.github.io/) shriftini yuklab oling
   (ochiq litsenziyali, bepul).
2. `DejaVuSans.ttf` faylini shu papkaga (`backend/app/assets/fonts/`)
   joylashtiring.

Boshqa Unicode TTF shriftlar (masalan, `NotoSans-Regular.ttf`) ham
ishlatilishi mumkin — shunchaki `pdf_service.py`dagi `DejaVuSans.ttf`
nomini mos ravishda o'zgartiring.
