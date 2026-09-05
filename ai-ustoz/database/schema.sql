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
