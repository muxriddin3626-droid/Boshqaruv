'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phone, password }),
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
      <h2>Ro'yxatdan o'tish</h2>
      {error && <div className="error">{error}</div>}
      <input
        className="input"
        placeholder="Ism familiya"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="Telefon raqam (+998...)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="Parol (kamida 6 belgi)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Yuklanmoqda...' : "Ro'yxatdan o'tish"}
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        Hisobingiz bormi? <Link href="/login">Kiring</Link>
      </p>
    </form>
  );
}
