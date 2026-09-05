import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listSubjects, listTopicsBySubject, attemptsByUser } from '@/lib/db';

const COURSE_PRICE = Number(process.env.COURSE_PRICE || 300000);
const PAYMENT_CONTACT = process.env.PAYMENT_CONTACT || '@admin';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (user.access_status !== 'faol') {
    return (
      <div className="card">
        <h2>To'lov kutilmoqda</h2>
        <p>
          Kursga kirish narxi: <strong>{COURSE_PRICE.toLocaleString('ru-RU')} so'm</strong>.
        </p>
        <p className="muted">
          To'lovni amalga oshirib, tasdiqlash uchun {PAYMENT_CONTACT} ga
          murojaat qiling. Admin to'lovingizni tasdiqlagach, barcha mavzular va
          testlar ochiladi.
        </p>
      </div>
    );
  }

  const subjects = await listSubjects();
  const subjectsWithTopics = await Promise.all(
    subjects.map(async (s) => ({ subject: s, topics: await listTopicsBySubject(s.id) }))
  );
  const attempts = await attemptsByUser(user.id);

  return (
    <div>
      {subjectsWithTopics.map(({ subject, topics }) => (
        <div className="card" key={subject.id}>
          <h2>{subject.name}</h2>
          {topics.length === 0 && <p className="muted">Hozircha mavzu yo'q.</p>}
          <ul className="topic-list">
            {topics.map((t) => (
              <li key={t.id}>
                <Link href={`/mavzu/${t.id}`}>{t.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {attempts.length > 0 && (
        <div className="card">
          <h3>Oxirgi natijalar</h3>
          <table>
            <tbody>
              {attempts.slice(0, 10).map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleString('uz-UZ')}</td>
                  <td>
                    {a.score} / {a.total}
                  </td>
                  <td>
                    <Link href={`/natija/${a.id}`}>Ko'rish</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
