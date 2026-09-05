import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./kirish-kursi.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  access_status TEXT NOT NULL DEFAULT 'kutilmoqda',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  text TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS choices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  ai_feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  question_id INTEGER NOT NULL REFERENCES questions(id),
  choice_id INTEGER REFERENCES choices(id),
  is_correct INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'kutilmoqda',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function run(sql, args = []) {
  return client.execute({ sql, args });
}

async function insertSubject(name, orderIndex) {
  const res = await run('INSERT INTO subjects (name, order_index) VALUES (?, ?)', [name, orderIndex]);
  return Number(res.lastInsertRowid);
}

async function insertTopic(subjectId, title, content, orderIndex) {
  const res = await run(
    'INSERT INTO topics (subject_id, title, content, order_index) VALUES (?, ?, ?, ?)',
    [subjectId, title, content, orderIndex]
  );
  return Number(res.lastInsertRowid);
}

async function insertQuestion(topicId, text, explanation, orderIndex) {
  const res = await run(
    'INSERT INTO questions (topic_id, text, explanation, order_index) VALUES (?, ?, ?, ?)',
    [topicId, text, explanation, orderIndex]
  );
  return Number(res.lastInsertRowid);
}

async function insertChoice(questionId, text, isCorrect, orderIndex) {
  await run('INSERT INTO choices (question_id, text, is_correct, order_index) VALUES (?, ?, ?, ?)', [
    questionId,
    text,
    isCorrect ? 1 : 0,
    orderIndex,
  ]);
}

async function main() {
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await run(stmt);
  }

  const existing = await run('SELECT COUNT(*) as c FROM subjects');
  if (existing.rows[0].c > 0) {
    console.log("Ma'lumotlar allaqachon mavjud, seed o'tkazib yuborildi.");
    return;
  }

  const kimyoId = await insertSubject('Kimyo', 0);
  const bioId = await insertSubject('Biologiya', 1);

  const atomTopicId = await insertTopic(
    kimyoId,
    'Atom tuzilishi va davriy sistema',
    [
      "Atom — musbat zaryadlangan yadro va uni o'rab turgan manfiy zaryadlangan",
      "elektronlardan tashkil topgan eng kichik zarracha. Yadro protonlar (musbat)",
      "va neytronlardan (zaryadsiz) iborat.",
      '',
      "Atom raqami (Z) — yadrodagi protonlar soniga teng va elementni aniqlaydi.",
      "Massa soni (A) — protonlar va neytronlar yig'indisi.",
      '',
      "D.I.Mendeleyev davriy sistemasida elementlar atom raqami ortishi tartibida",
      "joylashgan. Davr (qator) — elektron qavatlar soni; guruh (ustun) — tashqi",
      "qavatdagi elektronlar soni bir xil bo'lgan elementlar to'plami.",
      '',
      "Guruhdan pastga tushgan sari atom radiusi ortadi, elektromanfiylik kamayadi.",
      "Davr bo'ylab chapdan o'ngga o'tganda atom radiusi kamayadi, elektromanfiylik ortadi.",
    ].join('\n'),
    0
  );

  const q1 = await insertQuestion(
    atomTopicId,
    "Natriy (Na) atomining atom raqami 11. Uning yadrosida nechta proton bor?",
    "Atom raqami (Z) har doim yadrodagi protonlar soniga teng bo'ladi.",
    0
  );
  await insertChoice(q1, '9', false, 0);
  await insertChoice(q1, '11', true, 1);
  await insertChoice(q1, '12', false, 2);
  await insertChoice(q1, '23', false, 3);

  const q2 = await insertQuestion(
    atomTopicId,
    "Davriy sistemada guruh bo'yicha pastga tushgan sari qaysi xossa ortadi?",
    "Guruhda pastga tushgan sari elektron qavatlar soni ortadi, shuning uchun atom radiusi kattalashadi.",
    1
  );
  await insertChoice(q2, 'Elektromanfiylik', false, 0);
  await insertChoice(q2, 'Ionlanish energiyasi', false, 1);
  await insertChoice(q2, 'Atom radiusi', true, 2);
  await insertChoice(q2, 'Metallmaslik xossasi', false, 3);

  const q3 = await insertQuestion(
    atomTopicId,
    "Massa soni 27, atom raqami 13 bo'lgan atomda nechta neytron bor?",
    "Neytronlar soni = massa soni − atom raqami = 27 − 13 = 14.",
    2
  );
  await insertChoice(q3, '13', false, 0);
  await insertChoice(q3, '14', true, 1);
  await insertChoice(q3, '27', false, 2);
  await insertChoice(q3, '40', false, 3);

  const kislotaTopicId = await insertTopic(
    kimyoId,
    'Kislotalar, asoslar va tuzlar',
    [
      "Kislotalar — suvda eriganda vodorod ioni (H+) hosil qiluvchi moddalar",
      "(masalan HCl, H2SO4). Asoslar — gidroksid ioni (OH-) hosil qiluvchi",
      "moddalar (masalan NaOH, KOH).",
      '',
      "Neytrallanish reaksiyasi: kislota + asos -> tuz + suv.",
      "Masalan: HCl + NaOH -> NaCl + H2O.",
      '',
      "pH shkalasi 0 dan 14 gacha: pH < 7 — muhit kislotali, pH = 7 — neytral,",
      "pH > 7 — muhit ishqoriy (asosli).",
    ].join('\n'),
    1
  );

  const q4 = await insertQuestion(
    kislotaTopicId,
    'HCl + NaOH reaksiyasi natijasida qanday moddalar hosil bo\'ladi?',
    "Bu tipik neytrallanish reaksiyasi: kislota + asos -> tuz + suv.",
    0
  );
  await insertChoice(q4, 'NaCl va H2O', true, 0);
  await insertChoice(q4, 'NaCl va H2', false, 1);
  await insertChoice(q4, 'Na2O va HCl', false, 2);
  await insertChoice(q4, 'NaOH va Cl2', false, 3);

  const q5 = await insertQuestion(
    kislotaTopicId,
    "pH qiymati 3 bo'lgan eritma qanday muhitga ega?",
    'pH 7 dan kichik bo\'lsa muhit kislotali hisoblanadi.',
    1
  );
  await insertChoice(q5, 'Kuchli ishqoriy', false, 0);
  await insertChoice(q5, 'Neytral', false, 1);
  await insertChoice(q5, 'Kislotali', true, 2);
  await insertChoice(q5, 'Amfoter', false, 3);

  const hujayraTopicId = await insertTopic(
    bioId,
    'Hujayra tuzilishi',
    [
      "Hujayra — barcha tirik organizmlarning tuzilish va faoliyat birligi.",
      "Prokariot hujayralarda (bakteriyalar) shakllangan yadro yo'q, DNK",
      "sitoplazmada erkin joylashgan. Eukariot hujayralarda (o'simlik, hayvon,",
      "zamburug') haqiqiy yadro va membrana bilan o'ralgan organoidlar mavjud.",
      '',
      "Mitoxondriya — hujayraning 'energiya stansiyasi', ATP ishlab chiqaradi.",
      "Xloroplast — faqat o'simlik hujayralarida bo'lib, fotosintez jarayoni",
      "kechadi. Ribosoma — oqsil sintezi joyi. Yadro — DNK saqlanadigan va",
      "hujayra faoliyatini boshqaruvchi organoid.",
    ].join('\n'),
    0
  );

  const q6 = await insertQuestion(
    hujayraTopicId,
    "Hujayrada ATP energiyasini ishlab chiqaruvchi organoid qaysi?",
    "Mitoxondriya nafas olish jarayoni orqali ATP hosil qiladi, shuning uchun 'energiya stansiyasi' deb ataladi.",
    0
  );
  await insertChoice(q6, 'Ribosoma', false, 0);
  await insertChoice(q6, 'Mitoxondriya', true, 1);
  await insertChoice(q6, 'Golji apparati', false, 2);
  await insertChoice(q6, 'Lizosoma', false, 3);

  const q7 = await insertQuestion(
    hujayraTopicId,
    "Prokariot hujayralarni eukariot hujayralardan asosiy farqi nima?",
    "Prokariotlarda shakllangan (membrana bilan o'ralgan) yadro yo'q.",
    1
  );
  await insertChoice(q7, "Shakllangan yadroning yo'qligi", true, 0);
  await insertChoice(q7, "Hujayra devorining yo'qligi", false, 1);
  await insertChoice(q7, "DNK ning yo'qligi", false, 2);
  await insertChoice(q7, "Sitoplazmaning yo'qligi", false, 3);

  const genetikaTopicId = await insertTopic(
    bioId,
    'Genetika asoslari',
    [
      "Genetika — irsiyat va o'zgaruvchanlik haqidagi fan. Gregor Mendel",
      "genetikaning asoschisi hisoblanadi.",
      '',
      "Dominant belgi (A) — geterozigota holatda ham namoyon bo'ladigan belgi.",
      "Retsessiv belgi (a) — faqat gomozigota holatda (aa) namoyon bo'ladi.",
      '',
      "Monogibrid chatishtirishda F1 avlodda barcha organizmlar bir xil",
      "(dominant) fenotipga ega bo'ladi (Aa x Aa -> AA, Aa, Aa, aa nisbati 1:2:1,",
      "fenotip bo'yicha 3:1).",
    ].join('\n'),
    1
  );

  const q8 = await insertQuestion(
    genetikaTopicId,
    "Aa x Aa chatishtirishda F2 avlodda fenotip bo'yicha qanday nisbat kuzatiladi?",
    "Aa x Aa -> 1AA:2Aa:1aa genotip, fenotip bo'yicha 3 dominant : 1 retsessiv.",
    0
  );
  await insertChoice(q8, '1:1', false, 0);
  await insertChoice(q8, '3:1', true, 1);
  await insertChoice(q8, '1:2:1', false, 2);
  await insertChoice(q8, '9:3:3:1', false, 3);

  const q9 = await insertQuestion(
    genetikaTopicId,
    "Retsessiv belgi qanday genotipda namoyon bo'ladi?",
    "Retsessiv belgi faqat ikkala allel ham retsessiv bo'lganda (aa) namoyon bo'ladi.",
    1
  );
  await insertChoice(q9, 'AA', false, 0);
  await insertChoice(q9, 'Aa', false, 1);
  await insertChoice(q9, 'aa', true, 2);
  await insertChoice(q9, 'Barchasida', false, 3);

  console.log("Namuna ma'lumotlar muvaffaqiyatli qo'shildi: 2 ta fan, 4 ta mavzu, 9 ta savol.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
