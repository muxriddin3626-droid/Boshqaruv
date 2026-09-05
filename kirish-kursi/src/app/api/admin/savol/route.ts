import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createQuestion, createChoice } from '@/lib/db';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });

  const { topicId, text, explanation, choices } = await req.json();
  if (!topicId || !text || !Array.isArray(choices) || choices.length < 2) {
    return NextResponse.json(
      { error: "Mavzu, savol matni va kamida 2 ta variant kerak." },
      { status: 400 }
    );
  }
  if (!choices.some((c: { isCorrect: boolean }) => c.isCorrect)) {
    return NextResponse.json(
      { error: "Kamida bitta to'g'ri variant belgilang." },
      { status: 400 }
    );
  }

  const questionId = await createQuestion(Number(topicId), text, explanation || '');
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i];
    if (!c.text) continue;
    await createChoice(questionId, c.text, !!c.isCorrect, i);
  }

  return NextResponse.json({ ok: true, questionId });
}
