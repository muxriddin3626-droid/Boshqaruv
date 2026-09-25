# AI Ustoz

O'zbekistondagi DTM (BMBA) va Milliy Sertifikat imtihonlariga (Kimyo va Biologiya)
tayyorlaydigan, qattiqqo'l va talabchan xususiy repetitor xarakteridagi AI platforma.

**Maqsad:** o'quvchini 0 balldan 189 ballgacha olib chiqish, Milliy Sertifikatdan
A+ daraja oldirish va doimiy motivatsiyada tutish.

## Tezkor sinov (5 daqiqada brauzerda ochish)

Kompyuteringizda [Docker](https://docs.docker.com/get-docker/) o'rnatilgan bo'lsa,
butun stek (Postgres+pgvector, Redis, backend, frontend) bitta buyruq bilan
ishga tushadi — Supabase yoki boshqa tashqi xizmat shart emas:

```bash
git clone https://github.com/muxriddin3626-droid/Boshqaruv.git
cd Boshqaruv/ai-ustoz

cp backend/.env.example backend/.env
# backend/.env faylini oching va kamida shu 2 ta qatorni to'ldiring:
#   OPENAI_API_KEY=sk-...   (chat/ovoz/flashcard kabi AI funksiyalari uchun)
#   JWT_SECRET=istalgan-tasodifiy-matn

docker compose up --build
```

Bir necha daqiqadan so'ng:

1. **Test foydalanuvchi va kirish tokeni yarating** (yangi terminalda):
   ```bash
   docker compose exec backend python scripts/seed_test_user.py
   ```
   Skript ikki variant chiqaradi: brauzer konsoli uchun buyruq va tayyor
   `http://localhost:3000/?token=...` havola.
2. Shu havolani (yoki `http://localhost:3000`ni ochib, konsol buyrug'ini)
   brauzeringizda ishlating — ilova ochiladi.

Shundan so'ng barcha bo'limlar (Suhbat, Flashcard'lar, Zaif nuqtalar, Audio
kutubxona) haqiqiy ma'lumotlar bazasi bilan ishlaydi. `OPENAI_API_KEY` to'g'ri
qo'yilgan bo'lsa, chat/ovoz/flashcard-generatsiya kabi AI funksiyalari ham
to'liq ishlaydi.

### Telefondan sinash (bir xil Wi-Fi tarmog'ida)

Kompyuteringiz va telefoningiz **bir xil Wi-Fi tarmog'ida** bo'lsa:

1. Kompyuteringizning lokal tarmoq IP'ini toping:
   - Windows: `ipconfig` → "IPv4 Address" (Wi-Fi ostida)
   - macOS/Linux: `ifconfig` yoki `ip addr` → `en0`/`wlan0` ostidagi `inet`
   - Odatda `192.168.X.X` yoki `10.0.X.X` ko'rinishida bo'ladi.
2. `docker compose up --build` o'rniga shuni ishga tushiring:
   ```bash
   HOST_IP=192.168.X.X docker compose up --build
   ```
   (`192.168.X.X` — 1-qadamda topgan IP'ingiz)
3. Test foydalanuvchi/token'ni shu safar `--host` bilan yarating (yangi
   terminalda):
   ```bash
   docker compose exec backend python scripts/seed_test_user.py --host 192.168.X.X
   ```
4. Skript chiqargan **`http://192.168.X.X:3000/?token=...`** havolasini
   telefoningizga yuboring (Telegram/SMS/AirDrop — qanday qulay bo'lsa) va
   telefon brauzerida oching — DevTools kerak emas, sahifa ochilishi bilan
   token avtomatik saqlanadi.

> **Muhim cheklov:** brauzerlar (Chrome, Safari) mikrofon (`getUserMedia`)
> va Service Worker (PWA)ni faqat **HTTPS yoki `localhost`** ostida ishga
> tushiradi — oddiy `http://192.168.X.X` "xavfsiz kontekst" hisoblanmaydi.
> Ya'ni telefonda **Suhbat (matn), Flashcard'lar, Zaif nuqtalar, Audio
> kutubxona** to'liq ishlaydi, lekin **Ovozli suhbat (mikrofon)** tugmasi
> ishlamasligi mumkin — buni sinash uchun HTTPS bilan haqiqiy hosting kerak
> (masalan, Vercel + Render/Railway + Supabase — bu alohida deploy bosqichi).

> **Eslatma:** `scripts/seed_test_user.py` — Supabase Auth hali ulanmagan
> frontend uchun faqat lokal sinov yo'li (production'da ishlatilmasin).
> Audio Lecture Engine (Modul 8) uchun Supabase Storage kerak — bo'lmasa
> shu modul bundan tashqari hammasi ishlayveradi.

## Loyiha strukturasi

```
ai-ustoz/
├── backend/                   # FastAPI backend
│   ├── app/
│   │   ├── main.py            # Ilova kirish nuqtasi (FastAPI app, CORS, router'lar)
│   │   ├── core/
│   │   │   ├── config.py      # Environment sozlamalari (pydantic-settings)
│   │   │   └── security.py    # Supabase JWT tekshiruvi
│   │   ├── prompts/
│   │   │   ├── system_prompt.py     # STRICT TUTOR PERSONA system prompt qurilmasi
│   │   │   ├── debate_prompt.py     # MUNOZARA rejimi system prompt qurilmasi (Modul 2)
│   │   │   ├── exam_feedback_prompt.py  # Modul 6: Exam Feedback qo'shimchasi
│   │   │   └── innovation_prompt.py     # Modul 7: Innovative Teacher qo'shimchasi
│   │   ├── models/
│   │   │   ├── database.py    # SQLAlchemy ORM modellari
│   │   │   └── schemas.py     # Pydantic request/response sxemalari
│   │   ├── services/
│   │   │   ├── openai_service.py     # Chat streaming, Realtime voice, JSON/Whisper/Vision/TTS
│   │   │   ├── progress_service.py   # Progress/weak_spots CRUD + StudentContext
│   │   │   ├── rag_service.py        # pgvector orqali darslik matnlarini qidirish
│   │   │   ├── session_service.py    # Redis'dagi qisqa muddatli suhbat tarixi
│   │   │   ├── flashcard_service.py  # Modul 1: Spaced Repetition (Ebbinghaus)
│   │   │   ├── weakness_service.py   # Modul 3: Radar hisoblash + Targeted Drill
│   │   │   ├── pdf_service.py        # Modul 4: ReportLab PDF konspekt
│   │   │   ├── sync_service.py       # Modul 5: Offline sync (idempotent apply)
│   │   │   ├── exam_pipeline_service.py  # Modul 6: Voice/OCR->savol tiklash->embedding
│   │   │   ├── research_service.py       # Modul 7: Web-research + innovatsiya generatori
│   │   │   ├── scheduler.py              # Modul 7: APScheduler (async cron)
│   │   │   └── audio_service.py          # Modul 8: TTS + Supabase Storage
│   │   ├── api/routes/
│   │   │   ├── chat.py           # POST /api/v1/chat (SSE streaming)
│   │   │   ├── voice.py          # POST /api/v1/voice/session (tutor/debate rejimlari)
│   │   │   ├── progress.py       # GET progress, POST test-results
│   │   │   ├── flashcards.py     # Modul 1: generate/due/review
│   │   │   ├── weakness.py       # Modul 3: radar/drill
│   │   │   ├── conspect.py       # Modul 4: PDF generatsiya
│   │   │   ├── sync.py           # Modul 5: offline sync push
│   │   │   ├── exam_feedback.py  # Modul 6: status/submit (matn/ovoz/rasm)
│   │   │   ├── research.py       # Modul 7: scan/innovations (qo'lda ishga tushirish)
│   │   │   └── audio.py          # Modul 8: generate/list/save/delete
│   │   ├── assets/fonts/      # PDF uchun Unicode shrift (README bor, TTF qo'shilishi kerak)
│   │   └── db/
│   │       ├── session.py     # Async SQLAlchemy engine
│   │       └── redis_client.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                  # Next.js (App Router, TypeScript)
│   ├── app/
│   │   ├── layout.tsx          # Manifest, PWA service worker registratsiyasi
│   │   ├── page.tsx            # Fan tanlash + 4 bo'lim (Suhbat, Flashcard, Radar, Audio)
│   │   └── globals.css
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx       # Chat oynasi, SSE oqimini qabul qiladi
│   │   │   ├── MessageBubble.tsx    # + "Audio qilish" tugmasi (Modul 8)
│   │   │   ├── MarkdownRenderer.tsx # KaTeX render
│   │   │   └── MermaidDiagram.tsx   # Mermaid.js diagrammalar
│   │   ├── voice/
│   │   │   ├── VoiceSession.tsx     # WebRTC ulanish, tutor/debate rejim tanlovi
│   │   │   ├── NeonOrb.tsx          # Three.js 3D audio-reaktiv orb
│   │   │   └── useAudioVisualizer.ts
│   │   ├── flashcards/
│   │   │   └── FlashcardDeck.tsx    # Modul 1: flip-card + Esladim/Eslayolmadim
│   │   ├── weakness/
│   │   │   ├── WeaknessRadarChart.tsx  # Modul 3: Recharts Radar Chart
│   │   │   └── TargetedDrill.tsx       # Modul 3: "Zaif Nuqtalarni Ishlash"
│   │   ├── audio/
│   │   │   ├── AudioPlayer.tsx      # Modul 8: Play/Pause, 1x-2x tezlik, progress bar
│   │   │   └── AudioLibrary.tsx     # Modul 8: shaxsiy audio kutubxona (dashboard)
│   │   └── PwaRegister.tsx      # Modul 5: service worker registratsiyasi
│   ├── hooks/
│   │   └── useOnlineSync.ts    # Modul 5: online/offline kuzatuv + auto-sync
│   ├── lib/
│   │   ├── api.ts             # Backend bilan aloqa (fetch wrapper'lar)
│   │   ├── types.ts
│   │   └── offlineDb.ts        # Modul 5: IndexedDB navbat (flashcard/test natijalari)
│   ├── public/
│   │   ├── manifest.json       # PWA manifest
│   │   └── sw.js                # Offline "shell" keshi uchun service worker
│   └── package.json
│
├── database/
│   ├── schema.sql              # To'liq PostgreSQL sxemasi (pgvector bilan)
│   └── seed.sql                 # Namunaviy darslar ro'yxati
│
└── docker-compose.yml           # Lokal dev uchun (Redis + backend + frontend)
```

## Texnik stek

| Qatlam | Texnologiya |
|---|---|
| Frontend | Next.js 14 (App Router, TypeScript), Tailwind CSS, Framer Motion, KaTeX, Mermaid.js, Three.js, Recharts, IndexedDB (PWA) |
| Backend | Python FastAPI, OpenAI API (Chat + Realtime + Whisper + Vision + TTS + JSON mode), SQLAlchemy (async), ReportLab, APScheduler |
| Database | PostgreSQL (Supabase) + pgvector, Redis, Supabase Storage |

## 8 ta eksklyuziv modul

| # | Modul | Backend | Frontend |
|---|---|---|---|
| 1 | AI Smart Flashcards & Spaced Repetition | `flashcard_service.py`, `api/routes/flashcards.py` | `components/flashcards/FlashcardDeck.tsx` |
| 2 | AI Live Voice Debates | `prompts/debate_prompt.py`, `api/routes/voice.py` (`mode=debate`) | `VoiceSession.tsx` (rejim tugmasi) |
| 3 | Weakness Radar & Targeted Drill | `weakness_service.py`, `api/routes/weakness.py` | `WeaknessRadarChart.tsx`, `TargetedDrill.tsx` |
| 4 | Auto-PDF Konspekt Generator | `pdf_service.py` (ReportLab), `api/routes/conspect.py` | "PDF konspekt" tugmasi (`page.tsx`) |
| 5 | Offline Sync (PWA & IndexedDB) | `sync_service.py`, `api/routes/sync.py` | `lib/offlineDb.ts`, `hooks/useOnlineSync.ts`, `public/sw.js` |
| 6 | Exam Crowdsourcing & Memory Engine | `exam_pipeline_service.py` (Whisper/Vision OCR), `api/routes/exam_feedback.py` | — (chat/voice orqali tabiiy suhbat) |
| 7 | Autonomous AI Researcher & Innovator | `research_service.py`, `scheduler.py` (APScheduler), `api/routes/research.py` | — (natija `chat.py` promptiga in'ektsiya qilinadi) |
| 8 | Audio Lecture Engine | `audio_service.py` (TTS + Supabase Storage), `api/routes/audio.py` | `components/audio/AudioPlayer.tsx`, `AudioLibrary.tsx` |

Har birining mantiqiy oqimi `docs/ARCHITECTURE.md`da batafsil yozilgan.

## Ishga tushirish (lokal dev)

### 1. Backend

```bash
cd backend
cp .env.example .env   # OPENAI_API_KEY, DATABASE_URL (Supabase) ni to'ldiring
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Database

`database/schema.sql` faylini Supabase SQL Editor'da (yoki `psql`) ishga tushiring,
so'ng ixtiyoriy ravishda `database/seed.sql`.

### 2.1. Darsliklarni ulash (RAG bilim bazasi)

AI Ustoz javob berayotganda `knowledge_chunks` jadvalidagi darslik matnlariga
tayanadi (`rag_service.py`). Bu jadvalni Kimyo/Biologiya darslik PDF'lari bilan
to'ldirish uchun `backend/scripts/ingest_textbook.py` skriptidan foydalaning:

```bash
cd backend

# 1) Avval chunk'larga qanday bo'linishini ko'rib chiqing (OpenAI/DB'ga tegmaydi, bepul):
python scripts/ingest_textbook.py --pdf /path/to/kimyo-9-sinf.pdf --subject kimyo --grade 9 --dry-run

# 2) Chunk'lar to'g'ri ko'rinsa — real yuklash (embedding oladi va DB'ga yozadi):
python scripts/ingest_textbook.py --pdf /path/to/kimyo-9-sinf.pdf --subject kimyo --grade 9

# docker compose bilan ishlatayotgan bo'lsangiz:
docker compose exec backend python scripts/ingest_textbook.py --pdf /darsliklar/kimyo-9-sinf.pdf --subject kimyo --grade 9
```

Har bir fan/sinf uchun alohida PDF yuklang (masalan, `kimyo` 5–11-sinf va
`biologiya` 5–11-sinf uchun alohida-alohida). Xuddi shu darslikni qayta
yuklasangiz (masalan, yaxshiroq skanerlangan versiyasi bilan), eski
chunk'larni o'chirib qayta yozish uchun `--replace` flagini qo'shing.

**Eslatma:** skript faqat matn qatlami bor PDF'lar bilan ishlaydi (masalan,
Word'dan PDF'ga eksport qilingan yoki matn-based skanerlar). Agar darslik
sof rasm (skanerlangan sahifa, matn qatlamisiz) bo'lsa, avval OCR qilish
kerak — bu skript OCR qilmaydi.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### 4. Redis (agar docker ishlatmasangiz)

```bash
docker run -p 6379:6379 redis:7-alpine
```

Yoki butun stekni bitta buyruq bilan: `docker compose up --build`.

## Arxitektura haqida batafsil

Qaror va oqimlar tavsifi uchun `docs/ARCHITECTURE.md` faylini ko'ring.

## Muhim eslatmalar (production uchun)

- **Auth:** Frontend Supabase Auth orqali login qiladi, JWT backendga
  `Authorization: Bearer <token>` header orqali yuboriladi (`core/security.py`).
- **RAG ingestion:** `knowledge_chunks` jadvaliga darslik PDF'larini
  yuklash uchun `backend/scripts/ingest_textbook.py` skriptidan foydalaning
  (yuqoridagi "Darsliklarni ulash" bo'limiga qarang).
- **Realtime Voice:** Backend faqat ephemeral `client_secret` beradi;
  audio oqimi to'g'ridan-to'g'ri brauzer ↔ OpenAI orasida WebRTC orqali
  o'tadi (kechikishni minimal qilish uchun).
- **Xavfsizlik:** `.env` fayllarini hech qachon git'ga commit qilmang.
- **PDF shrift:** O'zbek lotin alifbosidagi maxsus belgilar (`oʻ`, `gʻ`) to'g'ri
  chiqishi uchun `backend/app/assets/fonts/DejaVuSans.ttf` faylini qo'shing
  (batafsil: `assets/fonts/README.md`). Fayl bo'lmasa, PDF baribir generatsiya
  bo'ladi, lekin standart Helvetica bilan.
- **PWA ikonkalari:** `frontend/public/manifest.json` `icons` maydonida
  ko'rsatilgan `/icons/icon-192.png` va `/icons/icon-512.png` fayllarini
  o'zingiz qo'shishingiz kerak (bu repo faqat manifest strukturasini beradi).
- **test_results.details formati:** Weakness Radar to'g'ri ishlashi uchun test
  natijalari `details.topic_breakdown` maydonida
  `{"<category>": {"correct": N, "total": M}}` strukturasida yuborilishi kerak
  (bu `TargetedDrill.tsx`da avtomatik shakllantiriladi).
- **Supabase Storage (Modul 8):** `audio_lectures` nomli PUBLIC bucket yaratib,
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`ni to'ldiring — aks holda audio
  generatsiya 502 xato qaytaradi. Bucket private bo'lsa, `audio_service.py`ni
  signed URL yaratadigan qilib o'zgartirish kerak bo'ladi.
- **Web-search provider (Modul 7):** `research_service.search_web()`
  Tavily/Serper uslubidagi JSON API kutadi (`WEB_SEARCH_API_URL`/
  `WEB_SEARCH_API_KEY`). Sozlanmasa, research skaneri jim ravishda hech narsa
  topmaydi — xato tashlamaydi.
- **Autonomous scheduler (Modul 7):** `RESEARCH_SCAN_ENABLED=true` qilib
  yoqilmaguncha fon vazifalari ishlamaydi (standart: o'chirilgan). Bir nechta
  `uvicorn` replika ishlatilsa, har biri alohida scheduler ishga tushiradi —
  productionda buni bitta markazlashgan worker (masalan, Celery Beat) orqali
  boshqarish tavsiya etiladi.
- **Exam Crowdsourcing (Modul 6):** `/api/v1/exam-feedback/submit` multipart
  form qabul qiladi (`subject`, `raw_input_type`, ixtiyoriy `text_input`,
  `audio_file` yoki `image_file`). Bu uchun maxsus frontend komponenti
  yozilmagan — hozircha backend/DB darajasida tayyor (spec talabiga ko'ra);
  chat/voice suhbati orqali tabiiy ravishda ishga tushadi.
