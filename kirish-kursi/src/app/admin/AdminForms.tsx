'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Topic = { id: number; title: string };
type Subject = { id: number; name: string };
type Payment = {
  id: number;
  amount: number;
  phone: string;
  full_name: string;
};

export default function AdminForms({
  subjectsWithTopics,
  pendingPayments,
}: {
  subjectsWithTopics: { subject: Subject; topics: Topic[] }[];
  pendingPayments: Payment[];
}) {
  const router = useRouter();
  const [subjectName, setSubjectName] = useState('');
  const [topicSubjectId, setTopicSubjectId] = useState(
    subjectsWithTopics[0]?.subject.id || 0
  );
  const [topicTitle, setTopicTitle] = useState('');
  const [topicContent, setTopicContent] = useState('');

  const allTopics = subjectsWithTopics.flatMap((s) => s.topics);
  const [questionTopicId, setQuestionTopicId] = useState(allTopics[0]?.id || 0);
  const [questionText, setQuestionText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [choices, setChoices] = useState([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [message, setMessage] = useState('');

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Xatolik');
    return data;
  }

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      await post('/api/admin/mavzu', { type: 'subject', name: subjectName });
      setSubjectName('');
      setMessage("Fan qo'shildi.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      await post('/api/admin/mavzu', {
        type: 'topic',
        subjectId: topicSubjectId,
        title: topicTitle,
        content: topicContent,
      });
      setTopicTitle('');
      setTopicContent('');
      setMessage("Mavzu qo'shildi.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      await post('/api/admin/savol', {
        topicId: questionTopicId,
        text: questionText,
        explanation,
        choices,
      });
      setQuestionText('');
      setExplanation('');
      setChoices([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
      setMessage("Savol qo'shildi.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function confirmPayment(paymentId: number) {
    setMessage('');
    try {
      await post('/api/admin/tolov', { paymentId });
      setMessage("To'lov tasdiqlandi.");
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <div>
      {message && (
        <div className="card" style={{ borderColor: '#2f6fed' }}>
          {message}
        </div>
      )}

      <div className="card">
        <h3>Kutilayotgan to'lovlar</h3>
        {pendingPayments.length === 0 && <p className="muted">Kutilayotgan to'lov yo'q.</p>}
        {pendingPayments.map((p) => (
          <div
            key={p.id}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}
          >
            <span>
              {p.full_name} ({p.phone}) — {p.amount.toLocaleString('ru-RU')} so'm
            </span>
            <button className="btn" onClick={() => confirmPayment(p.id)}>
              Tasdiqlash
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Yangi fan qo'shish</h3>
        <form onSubmit={addSubject}>
          <input
            className="input"
            placeholder="Fan nomi (masalan: Kimyo)"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
          />
          <button className="btn">Qo'shish</button>
        </form>
      </div>

      <div className="card">
        <h3>Yangi mavzu qo'shish</h3>
        <form onSubmit={addTopic}>
          <select
            className="input"
            value={topicSubjectId}
            onChange={(e) => setTopicSubjectId(Number(e.target.value))}
          >
            {subjectsWithTopics.map(({ subject }) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Mavzu nomi"
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
            required
          />
          <textarea
            className="input"
            placeholder="Dars matni"
            rows={5}
            value={topicContent}
            onChange={(e) => setTopicContent(e.target.value)}
          />
          <button className="btn">Qo'shish</button>
        </form>
      </div>

      <div className="card">
        <h3>Yangi test savoli qo'shish</h3>
        <form onSubmit={addQuestion}>
          <select
            className="input"
            value={questionTopicId}
            onChange={(e) => setQuestionTopicId(Number(e.target.value))}
          >
            {subjectsWithTopics.map(({ subject, topics }) =>
              topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {subject.name} — {t.title}
                </option>
              ))
            )}
          </select>
          <input
            className="input"
            placeholder="Savol matni"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
          />
          {choices.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                style={{ marginBottom: 0 }}
                placeholder={`Variant ${i + 1}`}
                value={c.text}
                onChange={(e) => {
                  const next = [...choices];
                  next[i] = { ...next[i], text: e.target.value };
                  setChoices(next);
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <input
                  type="radio"
                  name="correct"
                  checked={c.isCorrect}
                  onChange={() =>
                    setChoices(choices.map((ch, idx) => ({ ...ch, isCorrect: idx === i })))
                  }
                />
                To'g'ri
              </label>
            </div>
          ))}
          <textarea
            className="input"
            placeholder="Izoh (AI tahlilida ishlatiladi, ixtiyoriy)"
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
          <button className="btn">Qo'shish</button>
        </form>
      </div>
    </div>
  );
}
