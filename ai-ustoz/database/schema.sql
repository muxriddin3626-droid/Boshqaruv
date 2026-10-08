-- =============================================================================
-- AI USTOZ — PostgreSQL (Supabase) DATABASE SCHEMA
-- =============================================================================
-- Ishlatish: Supabase SQL Editor'da yoki `psql -f schema.sql` orqali bajaring.
-- pgvector kengaytmasi RAG (darslik matnlari embedding'lari) uchun kerak.
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- Eslatma: `subject` va `test_type` ataylab Postgres native `enum` turi emas,
-- `varchar` + `check` sifatida saqlanadi. Backend (SQLAlchemy) bu ustunlarni
-- VARCHAR sifatida bog'laydi (validatsiya Python/Pydantic enum darajasida
-- amalga oshiriladi) — agar bu yerda native `enum` ishlatilsa, Postgres har
-- bir so'rovda "operator does not exist: subject_enum = character varying"
-- xatosini beradi (asyncpg parametrni VARCHAR sifatida yuboradi, Postgres esa
-- avtomatik cast qilmaydi).
-- -----------------------------------------------------------------------------

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

-- Kirish so'rovnomasi (onboarding) javoblari. `alter ... if not exists` shaklida,
-- shunda bu fayl mavjud bazada qayta ishga tushirilganda ham ustunlar qo'shiladi.
alter table users add column if not exists is_graduate boolean not null default false;
alter table users add column if not exists subjects varchar(20) not null default 'ikkalasi'
    check (subjects in ('kimyo', 'biologiya', 'ikkalasi'));
alter table users add column if not exists target_exam varchar(30)
    check (target_exam in ('dtm', 'milliy_sertifikat', 'ikkalasi'));
alter table users add column if not exists target_cert_level varchar(2)
    check (target_cert_level in ('A+', 'A', 'B+', 'B', 'C+', 'C'));
alter table users add column if not exists target_university varchar(255);
alter table users add column if not exists self_level varchar(20)
    check (self_level in ('boshlangich', 'orta', 'yuqori'));
alter table users add column if not exists exam_month date;          -- imtihon oyi (oyning 1-kuni)
alter table users add column if not exists daily_study_minutes integer
    check (daily_study_minutes between 0 and 1440);
alter table users add column if not exists onboarded_at timestamptz;

-- Login: telefon raqam (+998XXXXXXXXX formatida) va parolning scrypt xeshi.
-- Parolning o'zi hech qachon saqlanmaydi.
alter table users add column if not exists phone varchar(13) unique;
alter table users add column if not exists password_hash varchar(255);

-- -----------------------------------------------------------------------------
-- LESSONS — DTM dasturi bo'yicha mavzular ro'yxati (sinf va fan kesimida tartiblangan)
-- -----------------------------------------------------------------------------
create table if not exists lessons (
    id              uuid primary key default uuid_generate_v4(),
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject             varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject                 varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
    test_type       varchar(30) not null check (test_type in ('oraliq', 'dtm_mock', 'milliy_sertifikat')),
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
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject             varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject                 varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject             varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
    subject             varchar(20) not null check (subject in ('kimyo', 'biologiya')),
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
-- TESTLAR, O'YINLAR VA REYTING
-- =============================================================================

-- XP va kunlik ketma-ketlik (streak). Streak Toshkent vaqti bo'yicha hisoblanadi.
alter table users add column if not exists xp_total integer not null default 0;
alter table users add column if not exists current_streak integer not null default 0;
alter table users add column if not exists longest_streak integer not null default 0;
alter table users add column if not exists last_active_on date;

-- -----------------------------------------------------------------------------
-- QUIZ_QUESTIONS — AI tuzgan va mustaqil yechib tekshirilgan savollar banki.
-- Bir marta tekshirilgan savol qayta ishlatiladi (tezlik, narx, duelda bir xil savollar).
-- -----------------------------------------------------------------------------
create table if not exists quiz_questions (
    id              uuid primary key default uuid_generate_v4(),
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
    category        varchar(100) not null,   -- yirik bo'lim (Weakness Radar o'qi), masalan "Organik kimyo"
    topic           varchar(150) not null,   -- mayda mavzu, masalan "Uglevodorodlar"
    difficulty      smallint not null check (difficulty between 1 and 5),
    qtype           varchar(20) not null check (qtype in ('mcq', 'true_false', 'matching')),
    question        text not null,
    -- mcq: 4 ta variant matni; true_false: ["To'g'ri", "Noto'g'ri"]; matching: [{"left", "right"}, ...]
    options         jsonb not null,
    correct_index   smallint,                -- matching uchun null (to'g'ri juftlar options ichida)
    explanation     text not null default '',
    hint            text,                    -- Millioner "Ustozdan maslahat" uchun
    content_hash    varchar(64) not null unique,
    source          varchar(20) not null default 'ai_verified',
    created_at      timestamptz not null default now()
);

create index if not exists idx_quiz_questions_pick on quiz_questions(subject, qtype, topic, difficulty);

-- -----------------------------------------------------------------------------
-- QUIZ_ATTEMPTS — har bir test yoki o'yin urinishi. Javob kaliti faqat serverda.
-- -----------------------------------------------------------------------------
create table if not exists quiz_attempts (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references users(id) on delete cascade,
    kind            varchar(20) not null check (kind in
                        ('dtm_mock', 'topic', 'milliy_sertifikat', 'millioner', 'blitz', 'matching', 'duel', 'homework')),
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya', 'ikkalasi')),
    question_ids    jsonb not null default '[]',
    answers         jsonb not null default '{}',   -- {question_id: tanlangan variant}
    state           jsonb not null default '{}',   -- o'yin holati (bosqich, yordamlar, kombo, ...)
    score           numeric(8, 1) not null default 0,
    max_score       numeric(8, 1) not null default 0,
    xp_earned       integer not null default 0,
    status          varchar(12) not null default 'active' check (status in ('active', 'finished')),
    started_at      timestamptz not null default now(),
    deadline_at     timestamptz,                   -- vaqt cheklovi serverda tekshiriladi
    finished_at     timestamptz
);

create index if not exists idx_quiz_attempts_user on quiz_attempts(user_id, started_at desc);
create index if not exists idx_quiz_attempts_finished on quiz_attempts(finished_at) where status = 'finished';

-- -----------------------------------------------------------------------------
-- DUELS — do'st bilan duel: ikkala o'yinchiga bir xil savollar. Har o'yinchining
-- javoblari o'z quiz_attempts qatorida (kind='duel', state.duel_id).
-- -----------------------------------------------------------------------------
create table if not exists duels (
    id              uuid primary key default uuid_generate_v4(),
    code            varchar(6) not null,
    subject         varchar(20) not null check (subject in ('kimyo', 'biologiya')),
    host_id         uuid not null references users(id) on delete cascade,
    guest_id        uuid references users(id) on delete cascade,
    question_ids    jsonb not null,
    status          varchar(10) not null default 'waiting'
                        check (status in ('waiting', 'active', 'finished', 'cancelled', 'expired')),
    winner_id       uuid references users(id) on delete set null,
    created_at      timestamptz not null default now(),
    started_at      timestamptz,
    deadline_at     timestamptz,
    finished_at     timestamptz
);

-- Kod faqat kutilayotgan/davom etayotgan duellar orasida noyob (tugaganlari qayta ishlatiladi).
create unique index if not exists idx_duels_open_code on duels(code) where status in ('waiting', 'active');

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

-- -----------------------------------------------------------------------------
-- STUDY_PLANS — kirish so'rovnomasidan (sinf, necha oy, haftada necha kun,
-- kunlik vaqt) tuzilgan shaxsiy haftalik o'quv reja. `plan` — haftalar va
-- mavzular, `completed` — mavzu testidan o'tilgan mavzular ("fan|mavzu" -> natija).
-- -----------------------------------------------------------------------------
alter table users add column if not exists study_months smallint check (study_months between 1 and 24);
alter table users add column if not exists study_days_per_week smallint check (study_days_per_week between 1 and 7);

create table if not exists study_plans (
    user_id     uuid primary key references users(id) on delete cascade,
    start_date  date not null,
    settings    jsonb not null,
    plan        jsonb not null,
    completed   jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- HOMEWORKS — darsdan keyin beriladigan uyga vazifa: test qismi (savollar
-- bankidan, avtomatik tekshiriladi) + yozma masalalar (AI tuzadi va mustaqil
-- yechib tasdiqlaydi; o'quvchi yechimini matn yoki daftar rasmi bilan yuboradi,
-- AI bosqichma-bosqich tekshiradi). `problems` ichidagi javob va yechim
-- tekshiruvdan oldin o'quvchiga yuborilmaydi. XP `quiz_attempts`ga
-- kind='homework' yozuvi orqali tushadi (haftalik reyting shu jadvaldan).
-- -----------------------------------------------------------------------------
alter table quiz_attempts drop constraint if exists quiz_attempts_kind_check;
alter table quiz_attempts add constraint quiz_attempts_kind_check check (kind in
    ('dtm_mock', 'topic', 'milliy_sertifikat', 'millioner', 'blitz', 'matching', 'duel', 'homework'));

create table if not exists homeworks (
    id            uuid primary key default uuid_generate_v4(),
    user_id       uuid not null references users(id) on delete cascade,
    subject       varchar(20) not null check (subject in ('kimyo', 'biologiya')),
    category      varchar(100) not null,
    topic         varchar(150) not null,
    status        varchar(10) not null default 'assigned' check (status in ('assigned', 'checked')),
    question_ids  jsonb not null default '[]',
    problems      jsonb not null default '[]',   -- [{problem, answer, solution_steps}]
    answers       jsonb,                         -- test javoblari {question_id: variant}
    submissions   jsonb,                         -- [{text, has_photo}]
    result        jsonb,                         -- tekshiruv natijasi va izohlar
    score         numeric(5, 1),
    max_score     numeric(5, 1),
    xp_earned     integer not null default 0,
    is_late       boolean not null default false,
    assigned_at   timestamptz not null default now(),
    due_at        timestamptz not null,
    checked_at    timestamptz
);

create index if not exists idx_homeworks_user on homeworks(user_id, assigned_at desc);
-- Har bir fan bo'yicha bir vaqtda bitta ochiq vazifa.
create unique index if not exists idx_homeworks_one_open on homeworks(user_id, subject) where status = 'assigned';
