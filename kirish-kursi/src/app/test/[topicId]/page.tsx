import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getTopic, listQuestionsByTopic, listChoicesByQuestion } from '@/lib/db';
import TestForm from './TestForm';

export default async function TestPage({ params }: { params: { topicId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.access_status !== 'faol') redirect('/dashboard');

  const topicId = Number(params.topicId);
  const topic = await getTopic(topicId);
  if (!topic) notFound();

  const questions = await listQuestionsByTopic(topicId);
  const withChoices = await Promise.all(
    questions.map(async (q) => ({
      id: q.id,
      text: q.text,
      choices: (await listChoicesByQuestion(q.id)).map((c) => ({ id: c.id, text: c.text })),
    }))
  );

  if (withChoices.length === 0) redirect(`/mavzu/${topicId}`);

  return (
    <div className="card">
      <h2>{topic.title} — test</h2>
      <TestForm topicId={topicId} questions={withChoices} />
    </div>
  );
}
