import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByPhone } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { phone, password } = await req.json();
  if (!phone || !password) {
    return NextResponse.json(
      { error: "Telefon raqam va parolni kiriting." },
      { status: 400 }
    );
  }

  const user = await getUserByPhone(phone);
  if (!user) {
    return NextResponse.json(
      { error: "Foydalanuvchi topilmadi." },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Parol noto'g'ri." }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, user: { id: user.id, role: user.role } });
}
