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
