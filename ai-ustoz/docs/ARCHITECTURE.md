# AI Ustoz — Arxitektura

## 1. Xarakter va System Prompt (Strict Tutor Persona)

`backend/app/prompts/system_prompt.py` moduli har bir chat so'rovi oldidan
`StudentContext` (ism, fan, sinf, oxirgi to'xtagan joy, weak_spots,
o'rtacha ball) asosida to'liq system promptni yig'adi. Xarakter promptga
qattiq yozib qo'yilgan: qattiqqo'l, satirik, lekin natijaga yo'naltirilgan
o'zbek repetitori. Model hech qachon tayyor javob bermasligi, faqat
yo'naltiruvchi savollar berishi promptda alohida ta'kidlangan.

Har bir `/api/v1/chat` so'rovida:
1. `progress_service.get_student_context()` Postgres'dan joriy holatni o'qiydi.
2. `build_system_prompt()` shu kontekst bilan promptni yig'adi.
3. `session_service` (Redis) oxirgi suhbat tarixini qo'shadi.
4. `rag_service` savolga mos darslik bo'laklarini qidirib, kontekstga qo'shadi.
5. `openai_service.stream_chat_response()` OpenAI'ga yuboradi va javobni
   token-token SSE orqali frontendga oqizadi.

## 2. Multimodal & Vizualizatsiya

- **KaTeX**: `MarkdownRenderer.tsx` `remark-math` + `rehype-katex` orqali
  `$...$` / `$$...$$` ichidagi LaTeX formulalarni chiroyli render qiladi.
- **Mermaid.js**: model javobida ` ```mermaid ` bloki bo'lsa,
  `MermaidDiagram.tsx` uni SVG diagrammaga aylantirib chizadi (Krebs sikli,
  Mendel katagi, reaksiya bosqichlari uchun).
- **RAG rasm in'ektsiyasi**: `knowledge_chunks.image_url` maydonida
  saqlangan darslik sxema/rasm havolalari `rag_service` orqali promptga
  qo'shiladi; model shu rasmga matnda ishora qiladi (to'liq rasm
  ko'rsatish uchun frontend'da havolani `<img>` sifatida render qilish
  qo'shimcha bosqich sifatida qo'shilishi mumkin).

## 3. State Persistence & Progress

Ikki qatlamli xotira arxitekturasi ishlatiladi:

| Qatlam | Texnologiya | Nima saqlanadi | TTL |
|---|---|---|---|
| Qisqa muddatli | Redis | Joriy suhbat xabarlari (oxirgi N ta) | ~24 soat |
| Uzoq muddatli | PostgreSQL | `progress` (joriy dars/bosqich), `weak_spots`, `test_results`, `chat_messages` (arxiv) | Doimiy |

O'quvchi tizimga qayta kirganda, frontend `GET /api/v1/progress/{subject}`
so'rovini yuboradi va `progress.current_step` asosida "Kecha shu yerda
to'xtagandik" bannerini ko'rsatadi. Bu ma'lumot bir vaqtning o'zida
system promptga ham uzatiladi — shuning uchun modelning o'zi ham xotirani
"eslaydi".

`weak_spots` jadvali — model suhbat davomida o'quvchining takroriy xato
qilayotgan mavzusini aniqlasa (masalan, `progress_service.record_weak_spot()`
chaqiruvi orqali — bu chaqiruv kelajakda function-calling/tool-use orqali
modelning o'ziga berilishi mumkin), shu yerga yoziladi va keyingi
suhbatlarda promptga "eslatma" sifatida qo'shiladi.

## 4. Real-time Voice & UI Visualizer

Ovozli suhbat **backend orqali audio oqizmaydi** — bu kechikishni oshiradi.
O'rniga:

1. Frontend `POST /api/v1/voice/session` chaqiradi.
2. Backend OpenAI Realtime API'dan bir martalik (ephemeral) `client_secret`
   oladi (`openai_service.create_realtime_voice_session()`).
3. Frontend shu tokendan foydalanib `RTCPeerConnection` orqali
   to'g'ridan-to'g'ri OpenAI serveriga ulanadi (SDP offer/answer almashinuvi,
   `VoiceSession.tsx`).
4. Kelayotgan audio track `useAudioVisualizer` hook orqali tahlil qilinadi
   (Web Audio API `AnalyserNode`), amplituda qiymati `NeonOrb.tsx`
   (Three.js) komponentiga uzatiladi — orb ovoz balandligiga qarab
   kattalashadi/porlaydi.

## 5. Nima keyingi bosqichda qo'shilishi kerak (production yo'l xaritasi)

- Darslik matnlarini avtomatik chunking + embedding qiluvchi ingestion
  pipeline (LangChain/LlamaIndex `DirectoryLoader` + `RecursiveCharacterTextSplitter`).
- Function-calling: model suhbat davomida `record_weak_spot` va
  `update_current_step` funksiyalarini o'zi chaqirishi (hozircha bu
  servislar tayyor, lekin tool-use bog'lanishi keyingi bosqich).
- To'liq Supabase Auth integratsiyasi (frontend login/signup oqimi).
- Alembic migratsiyalari (`schema.sql` — boshlang'ich manba haqiqat).
- Test testlarni avtomatik baholovchi modul (`test_results.details` dagi
  `wrong_topics` asosida `weak_spots`ni avtomatik yaratish).
