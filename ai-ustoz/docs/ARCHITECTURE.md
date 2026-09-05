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

## 5. Eksklyuziv modullar (Flashcards, Debate, Radar, PDF, Offline Sync)

### 5.1 AI Smart Flashcards & Spaced Repetition (Anki/Ebbinghaus)

`flashcard_service.py` Ebbinghaus unutish egri chizig'iga mos qat'iy interval
jadvalidan foydalanadi: `SPACED_REPETITION_INTERVALS_DAYS = [1, 3, 7, 30]`
(`models/database.py`). Har bir flashcard uchun `spaced_repetition_queue`
jadvalida bitta yozuv bo'ladi (`stage` — shu massivdagi joriy indeks):

- **"Esladim"** → `stage += 1`, `next_review_at = now + intervals[stage]`.
  Agar allaqachon oxirgi bosqichda (30 kun) bo'lsa → `status = "mastered"`
  (navbatdan butunlay chiqadi).
- **"Eslayolmadim"** → `stage = 0`, ya'ni ertaga qayta ko'rsatiladi — bu
  Ebbinghaus metodining asosiy g'oyasi (unutilgan narsa tez-tez
  takrorlanishi kerak).

Oqim: `POST /api/v1/flashcards/generate` (dars/suhbat matnidan AI orqali
kartalar yaratadi, JSON-mode) → `GET /api/v1/flashcards/due` (bugungi
kartalar) → `POST /api/v1/flashcards/review` (natijani yozadi).
`FlashcardDeck.tsx` bitta kartani ko'rsatadi, Framer Motion bilan flip
animatsiyasi qiladi.

### 5.2 AI Live Voice Debates (Munozara rejimi)

`prompts/debate_prompt.py` `build_debate_system_prompt()` — oddiy
`system_prompt.py`dan farqli, AI'ga ATAYIN noto'g'ri gipoteza aytishni va
o'quvchi kuchsiz dalil keltirsa yanada qat'iyroq turib olishni buyuradi.
Mavzu tanlash ustuvorligi: `topic_hint` (agar berilsa) → eng jiddiy
`weak_spot` → fan bo'yicha zaxira (fallback) mavzular ro'yxati.

`POST /api/v1/voice/session` endi `mode: "tutor" | "debate"` qabul qiladi
(`VoiceSessionIn`); `mode=debate` bo'lsa, ephemeral Realtime sessiya
`instructions` maydoni `build_debate_system_prompt()` natijasi bilan
to'ldiriladi. Butun munozara ovozli (speech-to-speech) davom etadi —
backend har bir gapni alohida baholamaydi, model o'zi jonli mulohaza
yuritadi. Frontendda `VoiceSession.tsx`ga oddiy rejim tugmasi qo'shildi.

### 5.3 Weakness Radar & Targeted Drill

`user_weakness_radar` jadvali — har bir fan bo'limi (`category`, masalan
"Genetika", "Organik kimyo") uchun 0-100% mastery foizini saqlaydigan
kesh. `weakness_service.recalculate_radar()`:

1. So'nggi `test_results.details.topic_breakdown` (`{category: {correct,
   total}}`) yig'indisidan mastery% hisoblaydi.
2. Hal qilinmagan `weak_spots` (agar `category` maydoni to'ldirilgan bo'lsa)
   severity darajasiga qarab yuqori chegara (cap) qo'yadi — masalan,
   severity=5 bo'lsa mastery 25%dan oshmaydi, hatto testda yaxshi natija
   bo'lsa ham (chunki weak_spot hali "hal qilinmagan").
3. Natija `user_weakness_radar`ga upsert qilinadi.

`GET /api/v1/weakness/radar` shu keshni qaytaradi (birinchi so'rovda hali
hisoblanmagan bo'lsa, on-the-fly hisoblaydi) — `WeaknessRadarChart.tsx`
buni Recharts `RadarChart`da chizadi. "Zaif Nuqtalarni Ishlash" tugmasi
(`TargetedDrill.tsx`) `POST /api/v1/weakness/drill`ni chaqiradi — bu eng
past mastery'li 2-3 bo'limni tanlab, OpenAI JSON-mode orqali faqat shu
bo'limlardan DTM uslubidagi test tuzadi. Test yakunlanganda natija
`test_results`ga (`topic_breakdown` bilan) yoziladi va bu radar'ni
avtomatik yangilaydi.

### 5.4 Auto-PDF Konspekt Generator

`pdf_service.py` uch bosqichda ishlaydi: (1) `chat_messages` va
`weak_spots`dan xom matn yig'iladi, (2)
`openai_service.summarize_for_conspect()` buni JSON-mode orqali
`{"formulas": [...], "rules": [...], "mistakes": [...]}` strukturasiga
aylantiradi, (3) ReportLab (`SimpleDocTemplate` + `Paragraph`/
`ListFlowable`) shu strukturadan PDF bayt oqimini yasaydi.
`POST /api/v1/conspect/generate` PDF'ni to'g'ridan-to'g'ri
`application/pdf` sifatida qaytaradi; frontend (`downloadLessonConspect`)
uni blob orqali brauzerda yuklab beradi.

O'zbek lotin alifbosidagi maxsus belgilar (`oʻ`, `gʻ`) uchun Unicode TTF
shrift kerak — `assets/fonts/README.md`da tushuntirilgan (fayl bo'lmasa,
avtomatik Helvetica'ga tushadi).

### 5.5 Offline Sync (PWA & IndexedDB)

Uch qatlamli oqim:

1. **Frontend keshlash**: `FlashcardDeck.tsx` har safar serverdan due
   kartalarni olganda `lib/offlineDb.ts` orqali IndexedDB'ga keshlaydi.
   Server bilan aloqa bo'lmasa, shu keshdan o'qiladi.
2. **Offline navbat**: internet yo'qligida "Esladim/Eslayolmadim" yoki
   test natijasi IndexedDB'ning `pending_reviews` / `pending_test_results`
   do'konlariga `client_action_id` (UUID) bilan birga yoziladi.
3. **Auto-sync**: `hooks/useOnlineSync.ts` `online` hodisasini kuzatadi va
   internet tiklanganda `POST /api/v1/sync/push`ni chaqiradi.
   `sync_service.py` har bir elementni Redis `SETNX
   sync:applied:{client_action_id}` orqali IDEMPOTENT qo'llaydi — shu
   bilan bir xil harakat tarmoq uzilib qayta yuborilsa ham ikki marta
   qo'llanilmaydi.

`public/sw.js` — service worker faqat ilova "shell"ini (statik sahifa)
keshlaydi, `/api/` so'rovlariga tegilmaydi (ular yuqoridagi IndexedDB
mantig'i orqali boshqariladi). `public/manifest.json` — PWA sifatida
"Bosh ekranga qo'shish" imkoniyatini beradi.

## 6. Nima keyingi bosqichda qo'shilishi kerak (production yo'l xaritasi)

- Darslik matnlarini avtomatik chunking + embedding qiluvchi ingestion
  pipeline (LangChain/LlamaIndex `DirectoryLoader` + `RecursiveCharacterTextSplitter`).
- Function-calling: model suhbat davomida `record_weak_spot` va
  `update_current_step` funksiyalarini o'zi chaqirishi (hozircha bu
  servislar tayyor, lekin tool-use bog'lanishi keyingi bosqich).
- To'liq Supabase Auth integratsiyasi (frontend login/signup oqimi).
- Alembic migratsiyalari (`schema.sql` — boshlang'ich manba haqiqat).
- Test testlarni avtomatik baholovchi modul (`test_results.details` dagi
  `wrong_topics` asosida `weak_spots`ni avtomatik yaratish).
- `sync_service.py`ni har bir element uchun alohida natija (applied/skipped/
  failed) qaytaradigan qilib kengaytirish — hozir frontend faqat umumiy
  sonlarni oladi va barcha yuborilgan elementlarni navbatdan o'chiradi.
- PDF konspekt uchun Unicode TTF shrift va PWA ikonkalarini (`icon-192.png`,
  `icon-512.png`) loyihaga qo'shish.
- Munozara rejimi (5.2) uchun frontendda tanlangan `topic_hint`ni
  `VoiceSessionIn`ga uzatish imkoniyatini qo'shish (hozir faqat backend
  weak_spot/fallback asosida avtomatik tanlaydi).
