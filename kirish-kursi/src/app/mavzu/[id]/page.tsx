import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic, listQuestionsByTopic } from '@/lib/db';

export default async function TopicPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.access_status !== 'faol') redirect('/dashboard');

  const topicId = Number(params.id);
  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const questions = await listQuestionsByTopic(topicId);

  return (
    <div>
      <div className="card">
        <h2>{topic.title}</h2>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{topic.content}</div>
      </div>

      <div className="card">
        <p className="muted">Bu mavzuda {questions.length} ta test savoli mavjud.</p>
        {questions.length > 0 ? (
          <Link href={`/test/${topic.id}`} className="btn">
            Testni boshlash
          </Link>
        ) : (
          <p className="muted">Hozircha bu mavzu uchun test yo'q.</p>
        )}
      </div>
    </div>
  );
}
