import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAttempt, getAnswersForAttempt, getTopic } from '@/lib/db';

export default async function ResultPage({ params }: { params: { attemptId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const attempt = await getAttempt(Number(params.attemptId));
  if (!attempt || attempt.user_id !== user.id) notFound();

  const topic = await getTopic(attempt.topic_id);
  const review = await getAnswersForAttempt(attempt.id);

  return (
    <div>
      <div className="card">
        <h2>{topic?.title} — natija</h2>
        <p style={{ fontSize: 22 }}>
          <strong>
            {attempt.score} / {attempt.total}
          </strong>
        </p>
      </div>

      <div className="card">
        <h3>Sun'iy intellekt tahlili</h3>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {attempt.ai_feedback || 'Tahlil tayyorlanmoqda...'}
        </div>
      </div>

      <div className="card">
        <h3>Javoblar tafsiloti</h3>
        {review.map((r) => (
          <div key={r.question_id} style={{ marginBottom: 16 }}>
            <p>
              <strong>{r.question_text}</strong>
            </p>
            <p className={`badge ${r.is_correct ? 'success' : 'danger'}`}>
              {r.is_correct ? "To'g'ri" : "Noto'g'ri"}
            </p>
            <p className="muted">Sizning javobingiz: {r.chosen_text ?? 'javob bermadingiz'}</p>
            {!r.is_correct && <p className="muted">To'g'ri javob: {r.correct_text}</p>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link href={`/test/${attempt.topic_id}`} className="btn secondary">
          Testni qayta ishlash
        </Link>
        <Link href="/dashboard" className="btn">
          Kursga qaytish
        </Link>
      </div>
    </div>
  );
}
