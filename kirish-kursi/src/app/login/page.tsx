'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Xatolik yuz berdi.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form className="form card" onSubmit={submit}>
      <h2>Kirish</h2>
      {error && <div className="error">{error}</div>}
      <input
        className="input"
        placeholder="Telefon raqam (+998...)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="Parol"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Yuklanmoqda...' : 'Kirish'}
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        Hisobingiz yo'qmi? <Link href="/royxat">Ro'yxatdan o'ting</Link>
      </p>
    </form>
  );
}
