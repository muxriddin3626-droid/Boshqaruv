import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./kirish-kursi.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient(
  authToken ? { url, authToken } : { url }
);

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

let readyPromise: Promise<void> | null = null;

export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const statements = SCHEMA.split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client.execute(stmt);
      }
    })();
  }
  return readyPromise;
}

export type User = {
  id: number;
  phone: string;
  full_name: string;
  password_hash: string;
  role: 'student' | 'admin';
  access_status: 'kutilmoqda' | 'faol';
  created_at: string;
};

export async function getUserByPhone(phone: string): Promise<User | null> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE phone = ?',
    args: [phone],
  });
  return (res.rows[0] as unknown as User) || null;
}

export async function getUserById(id: number): Promise<User | null> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });
  return (res.rows[0] as unknown as User) || null;
}

export async function createUser(
  phone: string,
  fullName: string,
  passwordHash: string
): Promise<User> {
  await ensureReady();
  const isFirstUser = (
    await client.execute('SELECT COUNT(*) as c FROM users')
  ).rows[0].c as number;
  const role = isFirstUser === 0 ? 'admin' : 'student';
  const accessStatus = isFirstUser === 0 ? 'faol' : 'kutilmoqda';
  await client.execute({
    sql: 'INSERT INTO users (phone, full_name, password_hash, role, access_status) VALUES (?, ?, ?, ?, ?)',
    args: [phone, fullName, passwordHash, role, accessStatus],
  });
  return (await getUserByPhone(phone))!;
}

export type Subject = { id: number; name: string; order_index: number };
export type Topic = {
  id: number;
  subject_id: number;
  title: string;
  content: string;
  order_index: number;
};
export type Question = {
  id: number;
  topic_id: number;
  text: string;
  explanation: string;
  order_index: number;
};
export type Choice = {
  id: number;
  question_id: number;
  text: string;
  is_correct: number;
  order_index: number;
};

export async function listSubjects(): Promise<Subject[]> {
  await ensureReady();
  const res = await client.execute(
    'SELECT * FROM subjects ORDER BY order_index, id'
  );
  return res.rows as unknown as Subject[];
}

export async function listTopicsBySubject(subjectId: number): Promise<Topic[]> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM topics WHERE subject_id = ? ORDER BY order_index, id',
    args: [subjectId],
  });
  return res.rows as unknown as Topic[];
}

export async function getTopic(topicId: number): Promise<Topic | null> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM topics WHERE id = ?',
    args: [topicId],
  });
  return (res.rows[0] as unknown as Topic) || null;
}

export async function listQuestionsByTopic(topicId: number): Promise<Question[]> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM questions WHERE topic_id = ? ORDER BY order_index, id',
    args: [topicId],
  });
  return res.rows as unknown as Question[];
}

export async function listChoicesByQuestion(questionId: number): Promise<Choice[]> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM choices WHERE question_id = ? ORDER BY order_index, id',
    args: [questionId],
  });
  return res.rows as unknown as Choice[];
}

export async function listChoicesByTopic(topicId: number): Promise<Choice[]> {
  await ensureReady();
  const res = await client.execute({
    sql: `SELECT choices.* FROM choices
          JOIN questions ON questions.id = choices.question_id
          WHERE questions.topic_id = ?
          ORDER BY choices.question_id, choices.order_index, choices.id`,
    args: [topicId],
  });
  return res.rows as unknown as Choice[];
}

export async function createAttempt(
  userId: number,
  topicId: number,
  score: number,
  total: number,
  aiFeedback: string | null
): Promise<number> {
  await ensureReady();
  const res = await client.execute({
    sql: 'INSERT INTO attempts (user_id, topic_id, score, total, ai_feedback) VALUES (?, ?, ?, ?, ?)',
    args: [userId, topicId, score, total, aiFeedback],
  });
  return Number(res.lastInsertRowid);
}

export async function addAnswer(
  attemptId: number,
  questionId: number,
  choiceId: number | null,
  isCorrect: boolean
): Promise<void> {
  await ensureReady();
  await client.execute({
    sql: 'INSERT INTO answers (attempt_id, question_id, choice_id, is_correct) VALUES (?, ?, ?, ?)',
    args: [attemptId, questionId, choiceId, isCorrect ? 1 : 0],
  });
}

export type Attempt = {
  id: number;
  user_id: number;
  topic_id: number;
  score: number;
  total: number;
  ai_feedback: string | null;
  created_at: string;
};

export async function getAttempt(attemptId: number): Promise<Attempt | null> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM attempts WHERE id = ?',
    args: [attemptId],
  });
  return (res.rows[0] as unknown as Attempt) || null;
}

export async function setAttemptFeedback(
  attemptId: number,
  feedback: string
): Promise<void> {
  await ensureReady();
  await client.execute({
    sql: 'UPDATE attempts SET ai_feedback = ? WHERE id = ?',
    args: [feedback, attemptId],
  });
}

export type AnswerReview = {
  question_id: number;
  question_text: string;
  chosen_choice_id: number | null;
  chosen_text: string | null;
  correct_text: string | null;
  is_correct: number;
  explanation: string;
};

export async function getAnswersForAttempt(attemptId: number): Promise<AnswerReview[]> {
  await ensureReady();
  const res = await client.execute({
    sql: `SELECT
            answers.question_id as question_id,
            questions.text as question_text,
            questions.explanation as explanation,
            answers.choice_id as chosen_choice_id,
            chosen.text as chosen_text,
            correct.text as correct_text,
            answers.is_correct as is_correct
          FROM answers
          JOIN questions ON questions.id = answers.question_id
          LEFT JOIN choices chosen ON chosen.id = answers.choice_id
          LEFT JOIN choices correct ON correct.question_id = questions.id AND correct.is_correct = 1
          WHERE answers.attempt_id = ?
          ORDER BY answers.id`,
    args: [attemptId],
  });
  return res.rows as unknown as AnswerReview[];
}

export async function attemptsByUser(userId: number): Promise<Attempt[]> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT * FROM attempts WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });
  return res.rows as unknown as Attempt[];
}

export async function createPayment(userId: number, amount: number): Promise<void> {
  await ensureReady();
  await client.execute({
    sql: 'INSERT INTO payments (user_id, amount) VALUES (?, ?)',
    args: [userId, amount],
  });
}

export type Payment = {
  id: number;
  user_id: number;
  amount: number;
  status: 'kutilmoqda' | 'tasdiqlangan';
  created_at: string;
};

export async function listPendingPayments(): Promise<(Payment & { phone: string; full_name: string })[]> {
  await ensureReady();
  const res = await client.execute(
    `SELECT payments.*, users.phone, users.full_name FROM payments
     JOIN users ON users.id = payments.user_id
     WHERE payments.status = 'kutilmoqda'
     ORDER BY payments.created_at`
  );
  return res.rows as unknown as (Payment & { phone: string; full_name: string })[];
}

export async function confirmPayment(paymentId: number): Promise<void> {
  await ensureReady();
  const res = await client.execute({
    sql: 'SELECT user_id FROM payments WHERE id = ?',
    args: [paymentId],
  });
  const userId = res.rows[0]?.user_id;
  await client.execute({
    sql: "UPDATE payments SET status = 'tasdiqlangan' WHERE id = ?",
    args: [paymentId],
  });
  if (userId) {
    await client.execute({
      sql: "UPDATE users SET access_status = 'faol' WHERE id = ?",
      args: [userId],
    });
  }
}

export async function createSubject(name: string, orderIndex = 0): Promise<number> {
  await ensureReady();
  const res = await client.execute({
    sql: 'INSERT INTO subjects (name, order_index) VALUES (?, ?)',
    args: [name, orderIndex],
  });
  return Number(res.lastInsertRowid);
}

export async function createTopic(
  subjectId: number,
  title: string,
  content: string,
  orderIndex = 0
): Promise<number> {
  await ensureReady();
  const res = await client.execute({
    sql: 'INSERT INTO topics (subject_id, title, content, order_index) VALUES (?, ?, ?, ?)',
    args: [subjectId, title, content, orderIndex],
  });
  return Number(res.lastInsertRowid);
}

export async function createQuestion(
  topicId: number,
  text: string,
  explanation: string,
  orderIndex = 0
): Promise<number> {
  await ensureReady();
  const res = await client.execute({
    sql: 'INSERT INTO questions (topic_id, text, explanation, order_index) VALUES (?, ?, ?, ?)',
    args: [topicId, text, explanation, orderIndex],
  });
  return Number(res.lastInsertRowid);
}

export async function createChoice(
  questionId: number,
  text: string,
  isCorrect: boolean,
  orderIndex = 0
): Promise<number> {
  await ensureReady();
  const res = await client.execute({
    sql: 'INSERT INTO choices (question_id, text, is_correct, order_index) VALUES (?, ?, ?, ?)',
    args: [questionId, text, isCorrect ? 1 : 0, orderIndex],
  });
  return Number(res.lastInsertRowid);
}
