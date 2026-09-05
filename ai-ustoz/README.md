# AI Ustoz

O'zbekistondagi DTM (BMBA) va Milliy Sertifikat imtihonlariga (Kimyo va Biologiya)
tayyorlaydigan, qattiqqo'l va talabchan xususiy repetitor xarakteridagi AI platforma.

**Maqsad:** o'quvchini 0 balldan 189 ballgacha olib chiqish, Milliy Sertifikatdan
A+ daraja oldirish va doimiy motivatsiyada tutish.

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
│   │   │   ├── system_prompt.py   # STRICT TUTOR PERSONA system prompt qurilmasi
│   │   │   └── debate_prompt.py   # MUNOZARA rejimi system prompt qurilmasi (Modul 2)
│   │   ├── models/
│   │   │   ├── database.py    # SQLAlchemy ORM modellari
│   │   │   └── schemas.py     # Pydantic request/response sxemalari
│   │   ├── services/
│   │   │   ├── openai_service.py     # Chat streaming, Realtime voice, JSON generatsiya
│   │   │   ├── progress_service.py   # Progress/weak_spots CRUD + StudentContext
│   │   │   ├── rag_service.py        # pgvector orqali darslik matnlarini qidirish
│   │   │   ├── session_service.py    # Redis'dagi qisqa muddatli suhbat tarixi
│   │   │   ├── flashcard_service.py  # Modul 1: Spaced Repetition (Ebbinghaus)
│   │   │   ├── weakness_service.py   # Modul 3: Radar hisoblash + Targeted Drill
│   │   │   ├── pdf_service.py        # Modul 4: ReportLab PDF konspekt
│   │   │   └── sync_service.py       # Modul 5: Offline sync (idempotent apply)
│   │   ├── api/routes/
│   │   │   ├── chat.py        # POST /api/v1/chat (SSE streaming)
│   │   │   ├── voice.py       # POST /api/v1/voice/session (tutor/debate rejimlari)
│   │   │   ├── progress.py    # GET progress, POST test-results
│   │   │   ├── flashcards.py  # Modul 1: generate/due/review
│   │   │   ├── weakness.py    # Modul 3: radar/drill
│   │   │   ├── conspect.py    # Modul 4: PDF generatsiya
│   │   │   └── sync.py        # Modul 5: offline sync push
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
│   │   ├── page.tsx            # Fan tanlash + 3 bo'lim (Suhbat, Flashcard, Radar)
│   │   └── globals.css
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx       # Chat oynasi, SSE oqimini qabul qiladi
│   │   │   ├── MessageBubble.tsx
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
| Backend | Python FastAPI, OpenAI API (Chat + Realtime + JSON mode), SQLAlchemy (async), ReportLab |
| Database | PostgreSQL (Supabase) + pgvector, Redis |

## 5 ta eksklyuziv modul

| # | Modul | Backend | Frontend |
|---|---|---|---|
| 1 | AI Smart Flashcards & Spaced Repetition | `flashcard_service.py`, `api/routes/flashcards.py` | `components/flashcards/FlashcardDeck.tsx` |
| 2 | AI Live Voice Debates | `prompts/debate_prompt.py`, `api/routes/voice.py` (`mode=debate`) | `VoiceSession.tsx` (rejim tugmasi) |
| 3 | Weakness Radar & Targeted Drill | `weakness_service.py`, `api/routes/weakness.py` | `WeaknessRadarChart.tsx`, `TargetedDrill.tsx` |
| 4 | Auto-PDF Konspekt Generator | `pdf_service.py` (ReportLab), `api/routes/conspect.py` | "PDF konspekt" tugmasi (`page.tsx`) |
| 5 | Offline Sync (PWA & IndexedDB) | `sync_service.py`, `api/routes/sync.py` | `lib/offlineDb.ts`, `hooks/useOnlineSync.ts`, `public/sw.js` |

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
- **RAG ingestion:** `knowledge_chunks` jadvaliga darslik matnlarini
  bo'laklab (chunking) va embedding qilib yuklovchi alohida skript kerak —
  bu repo faqat *retrieval* qismini o'z ichiga oladi.
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
