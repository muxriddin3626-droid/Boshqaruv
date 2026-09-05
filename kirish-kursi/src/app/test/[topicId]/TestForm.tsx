'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Choice = { id: number; text: string };
type Question = { id: number; text: string; choices: Choice[] };

export default function TestForm({
  topicId,
  questions,
}: {
  topicId: number;
  questions: Question[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function select(questionId: number, choiceId: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  }

  async function submit() {
    setError('');
    if (Object.keys(answers).length < questions.length) {
      setError("Iltimos, barcha savollarga javob bering.");
      return;
    }
    setLoading(true);
    const res = await fetch('/api/test/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId,
        answers: Object.entries(answers).map(([questionId, choiceId]) => ({
          questionId: Number(questionId),
          choiceId,
        })),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Xatolik yuz berdi.');
      return;
    }
    router.push(`/natija/${data.attemptId}`);
  }

  return (
    <div>
      {questions.map((q, idx) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p>
            <strong>
              {idx + 1}. {q.text}
            </strong>
          </p>
          {q.choices.map((c) => (
            <label
              key={c.id}
              className={`choice ${answers[q.id] === c.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={answers[q.id] === c.id}
                onChange={() => select(q.id, c.id)}
                style={{ marginRight: 8 }}
              />
              {c.text}
            </label>
          ))}
        </div>
      ))}
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit} disabled={loading}>
        {loading ? 'Yuborilmoqda...' : 'Javoblarni yuborish'}
      </button>
    </div>
  );
}
