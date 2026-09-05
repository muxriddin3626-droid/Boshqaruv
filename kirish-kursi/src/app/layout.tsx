import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import LogoutButton from './LogoutButton';

export const metadata = {
  title: "Kirish kursi — Kimyo va Biologiya",
  description:
    "Universitetga kirish uchun kimyo va biologiya fanlaridan tayyorlov kursi, sun'iy intellekt tahlili bilan.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="uz">
      <body>
        <div className="topbar">
          <Link href="/" className="brand">
            🧪🧬 Kirish kursi
          </Link>
          <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {user ? (
              <>
                <Link href="/dashboard">Kurs</Link>
                {user.role === 'admin' && <Link href="/admin">Admin</Link>}
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login">Kirish</Link>
                <Link href="/royxat" className="btn">
                  Ro'yxatdan o'tish
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
