import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { confirmPayment } from '@/lib/db';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Ruxsat yo'q." }, { status: 403 });

  const { paymentId } = await req.json();
  await confirmPayment(Number(paymentId));
  return NextResponse.json({ ok: true });
}
