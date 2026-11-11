# Fayllar papkasi — bu yerga yuklang

> **Eng oson yo'l — ilovaning o'zi:** administrator ilovada **"Darsliklar"** bo'limini
> ochadi, PDF ni tanlaydi (fan, sinf, nomi) va "Yuklash" ni bosadi. Server darslikni
> o'zi o'qiydi, skanerlangan sahifalarni OCR qiladi va bilim bazasiga yozadi.
> Administratorlar backend `.env` dagi `ADMIN_PHONES` (telefon raqamlari, vergul bilan)
> orqali belgilanadi. Fayl hajmi chegarasi — `TEXTBOOK_MAX_MB` (standart 100 MB).
>
> Quyidagi GitHub/skript usuli ham ishlaydi (skript faqat matnli PDF uchun, OCR qilmaydi).

Bu papka AI Ustoz bilim bazasini to'ldirish uchun **manba fayllar** joyi.
GitHub orqali to'g'ridan-to'g'ri yuklashingiz mumkin (chatning 30 MB
cheklovi bu yerda yo'q).

## Qayerga nima yuklanadi

```
data/
├── textbooks/
│   ├── kimyo/            <- Kimyo darsliklari:    5-sinf.pdf, 6-sinf.pdf, ...
│   └── biologiya/        <- Biologiya darsliklari: 5-sinf.pdf, 6-sinf.pdf, ...
└── milliy-sertifikat/
    ├── dastur/           <- MS sillabusi (mavzular ro'yxati)
    └── namunaviy-testlar/ <- MS namunaviy test to'plamlari
```

## Fayl nomlash qoidasi

Darsliklar uchun: `<sinf>-sinf.pdf` (masalan `9-sinf.pdf`).
Milliy sertifikat uchun: `<fan>-<yil>.pdf` (masalan `kimyo-2025.pdf`).

Nomi boshqacha bo'lsa ham muammo emas — asosiysi to'g'ri papkaga tushsin.

## Qanday yuklash

**GitHub sayti orqali (eng oson):**
1. Repo'da kerakli papkani oching
2. `Add file` → `Upload files`
3. Faylni tashlang va `Commit changes` bosing

Bitta fayl 25 MB gacha bo'lishi kerak. Kattaroq bo'lsa — `git` orqali
yuklang (100 MB gacha) yoki PDF'ni siqing.

**git orqali:**
```bash
git clone https://github.com/muxriddin3626-droid/Boshqaruv.git
cd Boshqaruv
git checkout claude/ai-ustoz-tutor-platform-xsuzfk
cp ~/Downloads/kimyo-9.pdf ai-ustoz/data/textbooks/kimyo/9-sinf.pdf
git add ai-ustoz/data && git commit -m "Add kimyo 9-sinf" && git push
```

## Yuklagandan keyin

Fayllar avtomatik bazaga tushmaydi. Serverda **bitta buyruq** hammasini yuklaydi
(matnli kitoblar, skaner kitoblar uchun OCR, bo'laklash, embedding):

```bash
# Avval ro'yxat va OCR narxini ko'rish (bepul, hech narsa yozilmaydi):
docker compose exec backend python scripts/import_textbooks.py --dry-run

# Hammasini yuklash (tayyor bo'lganlari qayta yuklanmaydi):
docker compose exec backend python scripts/import_textbooks.py
```

Sinf fayl nomidan olinadi (`kimyo_9_uzb.pdf` -> 9-sinf, `5-sinf.pdf` -> 5-sinf),
fan — papkadan. Yuklangan kitoblar ilovadagi "Darsliklar" bo'limida ko'rinadi.
