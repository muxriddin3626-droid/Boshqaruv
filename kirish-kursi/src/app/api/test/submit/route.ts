import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getTopic,
  listQuestionsByTopic,
  listChoicesByQuestion,
  createAttempt,
  addAnswer,
} from '@/lib/db';
import { generateFeedback, type AnsweredQuestion } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Kirish talab qilinadi.' }, { status: 401 });
  if (user.access_status !== 'faol') {
    return NextResponse.json({ error: "To'lov tasdiqlanmagan." }, { status: 403 });
  }

  const { topicId, answers } = await req.json();
  const topic = await getTopic(Number(topicId));
  if (!topic) return NextResponse.json({ error: 'Mavzu topilmadi.' }, { status: 404 });

  const questions = await listQuestionsByTopic(topic.id);
  const answerMap = new Map<number, number>(
    (answers as { questionId: number; choiceId: number }[]).map((a) => [a.questionId, a.choiceId])
  );

  let score = 0;
  const graded: AnsweredQuestion[] = [];
  const attemptId = await createAttempt(user.id, topic.id, 0, questions.length, null);

  for (const q of questions) {
    const choices = await listChoicesByQuestion(q.id);
    const correctChoice = choices.find((c) => c.is_correct);
    const chosenId = answerMap.get(q.id) ?? null;
    const chosenChoice = choices.find((c) => c.id === chosenId) || null;
    const isCorrect = !!chosenChoice && !!correctChoice && chosenChoice.id === correctChoice.id;
    if (isCorrect) score += 1;

    await addAnswer(attemptId, q.id, chosenId, isCorrect);
    graded.push({
      text: q.text,
      chosenText: chosenChoice?.text ?? null,
      correctText: correctChoice?.text ?? '',
      isCorrect,
      explanation: q.explanation,
    });
  }

  const feedback = await generateFeedback(topic.title, graded);

  const { client } = await import('@/lib/db');
  await client.execute({
    sql: 'UPDATE attempts SET score = ?, ai_feedback = ? WHERE id = ?',
    args: [score, feedback, attemptId],
  });

  return NextResponse.json({ ok: true, attemptId, score, total: questions.length });
}
