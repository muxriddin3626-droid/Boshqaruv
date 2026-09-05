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
│   │   │   └── system_prompt.py   # STRICT TUTOR PERSONA system prompt qurilmasi
│   │   ├── models/
│   │   │   ├── database.py    # SQLAlchemy ORM modellari
│   │   │   └── schemas.py     # Pydantic request/response sxemalari
│   │   ├── services/
│   │   │   ├── openai_service.py    # Chat streaming + Realtime voice session
│   │   │   ├── progress_service.py  # Progress/weak_spots CRUD + StudentContext
│   │   │   ├── rag_service.py       # pgvector orqali darslik matnlarini qidirish
│   │   │   └── session_service.py   # Redis'dagi qisqa muddatli suhbat tarixi
│   │   ├── api/routes/
│   │   │   ├── chat.py        # POST /api/v1/chat (SSE streaming)
│   │   │   ├── voice.py       # POST /api/v1/voice/session (ephemeral token)
│   │   │   └── progress.py    # GET progress, POST test-results
│   │   └── db/
│   │       ├── session.py     # Async SQLAlchemy engine
│   │       └── redis_client.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                  # Next.js (App Router, TypeScript)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Fan tanlash + Chat + Voice sahifasi
│   │   └── globals.css
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx       # Chat oynasi, SSE oqimini qabul qiladi
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MarkdownRenderer.tsx # KaTeX render
│   │   │   └── MermaidDiagram.tsx   # Mermaid.js diagrammalar
│   │   └── voice/
│   │       ├── VoiceSession.tsx     # WebRTC ulanish (OpenAI Realtime API)
│   │       ├── NeonOrb.tsx          # Three.js 3D audio-reaktiv orb
│   │       └── useAudioVisualizer.ts
│   ├── lib/
│   │   ├── api.ts             # Backend bilan aloqa (fetch wrapper'lar)
│   │   └── types.ts
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
| Frontend | Next.js 14 (App Router, TypeScript), Tailwind CSS, Framer Motion, KaTeX, Mermaid.js, Three.js |
| Backend | Python FastAPI, OpenAI API (Chat + Realtime), SQLAlchemy (async) |
| Database | PostgreSQL (Supabase) + pgvector, Redis |

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
