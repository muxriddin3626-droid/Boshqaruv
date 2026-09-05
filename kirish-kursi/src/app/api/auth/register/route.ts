import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, getUserByPhone, createPayment } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

const COURSE_PRICE = Number(process.env.COURSE_PRICE || 300000);

export async function POST(req: NextRequest) {
  const { phone, fullName, password } = await req.json();

  if (!phone || !fullName || !password) {
    return NextResponse.json(
      { error: "Barcha maydonlarni to'ldiring." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Parol kamida 6 belgidan iborat bo'lishi kerak." },
      { status: 400 }
    );
  }

  const existing = await getUserByPhone(phone);
  if (existing) {
    return NextResponse.json(
      { error: "Bu telefon raqami bilan foydalanuvchi allaqachon ro'yxatdan o'tgan." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser(phone, fullName, passwordHash);
  if (user.role === 'student') {
    await createPayment(user.id, COURSE_PRICE);
  }

  const token = await createSessionToken(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
}
