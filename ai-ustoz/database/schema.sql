-- =============================================================================
-- AI USTOZ — PostgreSQL (Supabase) DATABASE SCHEMA
-- =============================================================================
-- Ishlatish: Supabase SQL Editor'da yoki `psql -f schema.sql` orqali bajaring.
-- pgvector kengaytmasi RAG (darslik matnlari embedding'lari) uchun kerak.
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- ENUM turlari
-- -----------------------------------------------------------------------------
do $$ begin
    create type subject_enum as enum ('kimyo', 'biologiya');
exception when duplicate_object then null;
end $$;

do $$ begin
    create type test_type_enum as enum ('oraliq', 'dtm_mock', 'milliy_sertifikat');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- USERS — o'quvchilar (Supabase Auth bilan bog'lanadi: id = auth.users.id)
-- -----------------------------------------------------------------------------
create table if not exists users (
    id              uuid primary key default uuid_generate_v4(),
    full_name       varchar(255) not null,
    email           varchar(255) unique,
    telegram_id     varchar(64) unique,
    current_grade   integer not null default 9 check (current_grade between 5 and 11),
    target_score    integer not null default 189,
    created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- LESSONS — DTM dasturi bo'yicha mavzular ro'yxati (sinf va fan kesimida tartiblangan)
-- -----------------------------------------------------------------------------
create table if not exists lessons (
    id              uuid primary key default uuid_generate_v4(),
    subject         subject_enum not null,
    grade           integer not null check (grade between 5 and 11),
    topic_order     integer not null,
    title           varchar(255) not null,
    category        varchar(100),          -- masalan: "Organik kimyo", "Genetika" — Weakness Radar uchun guruh
    unique (subject, grade, topic_order)
);

-- -----------------------------------------------------------------------------
-- PROGRESS — har bir o'quvchi/fan bo'yicha JORIY holat ("qayerda to'xtagan")
-- -----------------------------------------------------------------------------
create table if not exists progress (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references users(id) on delete cascade,
    subject             subject_enum not null,
    current_lesson_id   uuid references lessons(id),
    current_step        varchar(255),         -- masalan: "3-masala, Alkanlar izomeriyasi"
    average_score       double precision,      -- so'nggi testlar o'rtacha foizi
    updated_at          timestamptz not null default now(),
    unique (user_id, subject)
);

create index if not exists idx_progress_user on progress(user_id);

-- -----------------------------------------------------------------------------
-- WEAK_SPOTS — o'quvchi doimiy xato qiladigan mavzular
-- -----------------------------------------------------------------------------
create table if not exists weak_spots (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 uuid not null references users(id) on delete cascade,
    subject                 subject_enum not null,
    topic                   varchar(255) not null,
    category                varchar(100),          -- Weakness Radar guruhi (Lessons.category bilan mos)
    mistake_description     text not null,
    severity                integer not null default 1 check (severity between 1 and 5),
    resolved                boolean not null default false,
    created_at              timestamptz not null default now()
);

create index if not exists idx_weak_spots_user_subject on weak_spots(user_id, subject) where not resolved;

-- -----------------------------------------------------------------------------
-- TEST_RESULTS — yechilgan testlar (oraliq, DTM mock, Milliy Sertifikat)
-- -----------------------------------------------------------------------------
create table if not exists test_results (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references users(id) on delete cascade,
    subject         subject_enum not null,
    test_type       test_type_enum not null,
    score           double precision not null,
    max_score       double precision not null,
    details         jsonb not null default '{}'::jsonb,   -- {"wrong_topics": [...], "duration_sec": ...}
    taken_at        timestamptz not null default now()
);

create index if not exists idx_test_results_user on test_results(user_id, subject, taken_at desc);

-- -----------------------------------------------------------------------------
-- CHAT_MESSAGES — uzoq muddatli suhbat arxivi (qisqa muddatli holat Redisda)
-- -----------------------------------------------------------------------------
create table if not exists chat_messages (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references users(id) on delete cascade,
    subject         subject_enum not null,
    role            varchar(20) not null check (role in ('user', 'assistant')),
    content         text not null,
    created_at      timestamptz not null default now()
);

create index if not exists idx_chat_messages_user on chat_messages(user_id, subject, created_at);

-- -----------------------------------------------------------------------------
-- KNOWLEDGE_CHUNKS — RAG uchun darslik matn bo'laklari + rasm/sxema havolalari
-- text-embedding-3-small o'lchami = 1536
-- -----------------------------------------------------------------------------
create table if not exists knowledge_chunks (
    id              uuid primary key default uuid_generate_v4(),
    subject         subject_enum not null,
    grade           integer not null check (grade between 5 and 11),
    source_title    varchar(255) not null,     -- masalan: "9-sinf Kimyo darsligi, 24-bet"
    chunk_text      text not null,
    image_url       varchar(512),              -- darslikdagi sxema/rasm havolasi (Supabase Storage)
    embedding       vector(1536) not null
);

-- Approximate Nearest Neighbor qidiruv uchun ivfflat indeks (cosine distance)
create index if not exists idx_knowledge_chunks_embedding
    on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

create index if not exists idx_knowledge_chunks_subject_grade on knowledge_chunks(subject, grade);

-- =============================================================================
-- MODUL 1: AI SMART FLASHCARDS & SPACED REPETITION (Ebbinghaus/Anki metodi)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FLASHCARDS — AI tomonidan dars/suhbat oxirida avtomatik generatsiya qilingan kartalar
-- -----------------------------------------------------------------------------
create table if not exists flashcards (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references users(id) on delete cascade,
    subject         subject_enum not null,
    lesson_id       uuid references lessons(id),
    front_text      text not null,          -- savol/atama (old tarafi)
    back_text       text not null,          -- javob/tushuntirish (orqa tarafi, KaTeX bo'lishi mumkin)
    created_at      timestamptz not null default now()
);

create index if not exists idx_flashcards_user_subject on flashcards(user_id, subject);

-- -----------------------------------------------------------------------------
-- SPACED_REPETITION_QUEUE — har bir karta uchun keyingi takrorlash vaqti
-- interval_days ketma-ketligi: [1, 3, 7, 30] — Ebbinghaus unutish egri chizig'i
-- -----------------------------------------------------------------------------
create table if not exists spaced_repetition_queue (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references users(id) on delete cascade,
    flashcard_id        uuid not null references flashcards(id) on delete cascade,
    stage               integer not null default 0,        -- interval_days massividagi indeks
    remembered_streak   integer not null default 0,
    status              varchar(20) not null default 'active' check (status in ('active', 'mastered')),
    next_review_at      timestamptz not null default now(),
    last_reviewed_at    timestamptz,
    last_result         varchar(20) check (last_result in ('remembered', 'forgot')),
    created_at          timestamptz not null default now(),
    unique (flashcard_id)
);

create index if not exists idx_srq_due on spaced_repetition_queue(user_id, next_review_at) where status = 'active';

-- =============================================================================
-- MODUL 3: WEAKNESS RADAR & TARGETED DRILL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USER_WEAKNESS_RADAR — o'quvchining har bir bo'lim (category) bo'yicha
-- o'zlashtirish foizi. `weakness_service.recalculate_radar()` tomonidan
-- test_results va weak_spots asosida qayta hisoblanadi (materialized cache).
-- -----------------------------------------------------------------------------
create table if not exists user_weakness_radar (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references users(id) on delete cascade,
    subject             subject_enum not null,
    category            varchar(100) not null,     -- masalan: "Genetika", "Organik kimyo"
    mastery_percentage  double precision not null default 50 check (mastery_percentage between 0 and 100),
    sample_size         integer not null default 0,  -- necha ta test/xato asosida hisoblangani
    updated_at          timestamptz not null default now(),
    unique (user_id, subject, category)
);

create index if not exists idx_weakness_radar_user_subject on user_weakness_radar(user_id, subject);

-- =============================================================================
-- MODUL 6: EXAM CROWDSOURCING & MEMORY ENGINE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STUDENT_EXAM_STATUS — o'quvchining imtihon holati ("Exam Today" belgisi).
-- Har bir o'quvchi uchun bitta yozuv (1:1 users bilan).
-- -----------------------------------------------------------------------------
create table if not exists student_exam_status (
    user_id             uuid primary key references users(id) on delete cascade,
    target_exam_date    date,
    exam_completed      boolean not null default false,
    feedback_provided   boolean not null default false,
    updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- REAL_EXAM_SUBMITTED_QUESTIONS — o'quvchilar imtihondan keyin "topshirgan"
-- (og'zaki/matn/rasm orqali) haqiqiy savollar. AI tomonidan tiklanadi,
-- mavzusi va qiyinchilik darajasi aniqlanadi, yechimi tayyorlanadi va
-- vector qidiruv uchun embedding qilinadi (AI'ning "xotira bazasi").
-- -----------------------------------------------------------------------------
create table if not exists real_exam_submitted_questions (
    id                      uuid primary key default uuid_generate_v4(),
    user_id                 uuid not null references users(id) on delete cascade,
    subject                 subject_enum not null,
    raw_input_type          varchar(10) not null check (raw_input_type in ('text', 'voice', 'image')),
    topic                   varchar(255),               -- AI aniqlagan mavzu nomi
    grade                   integer check (grade between 5 and 11),
    cert_level              varchar(50),                -- masalan: "Milliy Sertifikat", "DTM/BMBA"
    difficulty_level        varchar(10) check (difficulty_level in ('A', 'A+')),
    reconstructed_question  text not null,               -- AI tomonidan tiklangan/tuzatilgan savol matni
    verified_solution       text,                        -- AI tayyorlagan to'liq, tekshirilgan yechim
    vector_embedding        vector(1536),
    submission_date         timestamptz not null default now()
);

create index if not exists idx_real_exam_questions_subject on real_exam_submitted_questions(subject, topic);

-- Vector qidiruv uchun ivfflat indeks (cosine distance) — o'xshash savollarni topish uchun
create index if not exists idx_real_exam_questions_embedding
    on real_exam_submitted_questions using ivfflat (vector_embedding vector_cosine_ops)
    with (lists = 100);

-- =============================================================================
-- MODUL 7: AUTONOMOUS AI RESEARCHER & PEDAGOGICAL INNOVATOR ENGINE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- AI_GENERATED_INNOVATIONS — AI mustaqil generatsiya qilgan yangi tushuntirish
-- usullari (NEW_METHOD) va yangi "tuzoq masalalar" (TRICK_QUESTION).
-- Weakness Radar'dagi eng zaif bo'limlarga qarata yaratiladi.
-- -----------------------------------------------------------------------------
create table if not exists ai_generated_innovations (
    id                  uuid primary key default uuid_generate_v4(),
    subject             subject_enum not null,
    topic_id            uuid references lessons(id),
    innovation_type     varchar(20) not null check (innovation_type in ('NEW_METHOD', 'TRICK_QUESTION')),
    content             text not null,          -- yangi usul/masala matni
    explanation         text not null,          -- nima uchun samarali / yechim tushuntirishi
    validation_score    double precision default 0,  -- 0-1 oralig'ida sifat bahosi (auto yoki inson)
    created_at          timestamptz not null default now()
);

create index if not exists idx_innovations_subject_topic on ai_generated_innovations(subject, topic_id);

-- -----------------------------------------------------------------------------
-- AI_RESEARCH_LOGS — AI mustaqil izlanish (web-scan) natijalari jurnali.
-- -----------------------------------------------------------------------------
create table if not exists ai_research_logs (
    id                          uuid primary key default uuid_generate_v4(),
    source_url                  varchar(1024),
    topic                       varchar(255),
    extracted_insight           text not null,
    added_to_knowledge_base     boolean not null default false,
    "timestamp"                 timestamptz not null default now()
);

-- =============================================================================
-- MODUL 8: AUDIO LECTURE ENGINE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USER_AUDIO_LECTURES — AI Ustoz ma'ruzalarining audio (TTS) versiyalari.
-- Fayl Supabase Storage'ning `audio_lectures` bucket'ida saqlanadi, bu yerda
-- faqat ommaviy URL va metadata saqlanadi.
-- -----------------------------------------------------------------------------
create table if not exists user_audio_lectures (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references users(id) on delete cascade,
    subject             subject_enum not null,
    grade               integer check (grade between 5 and 11),
    lecture_title       varchar(255) not null,
    lecture_summary     text,
    audio_url           varchar(1024) not null,
    duration_seconds    integer not null default 0,
    is_saved            boolean not null default true,
    created_at          timestamptz not null default now()
);

create index if not exists idx_audio_lectures_user on user_audio_lectures(user_id, subject, created_at desc);

-- =============================================================================
-- Eslatma: `updated_at` maydonini avtomatik yangilash uchun trigger
-- =============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_progress_updated_at on progress;
create trigger trg_progress_updated_at
    before update on progress
    for each row execute function set_updated_at();

drop trigger if exists trg_weakness_radar_updated_at on user_weakness_radar;
create trigger trg_weakness_radar_updated_at
    before update on user_weakness_radar
    for each row execute function set_updated_at();

drop trigger if exists trg_exam_status_updated_at on student_exam_status;
create trigger trg_exam_status_updated_at
    before update on student_exam_status
    for each row execute function set_updated_at();
