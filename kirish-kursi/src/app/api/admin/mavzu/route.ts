import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createSubject, createTopic } from '@/lib/db';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });

  const body = await req.json();

  if (body.type === 'subject') {
    if (!body.name) return NextResponse.json({ error: 'Fan nomi kerak.' }, { status: 400 });
    const id = await createSubject(body.name);
    return NextResponse.json({ ok: true, id });
  }

  if (body.type === 'topic') {
    if (!body.subjectId || !body.title) {
      return NextResponse.json({ error: 'Fan va mavzu nomi kerak.' }, { status: 400 });
    }
    const id = await createTopic(Number(body.subjectId), body.title, body.content || '');
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: "Noto'g'ri so'rov turi." }, { status: 400 });
}
