import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div>
      <div className="card">
        <h1>Universitetga kirish uchun Kimyo va Biologiya kursi</h1>
        <p className="muted">
          Mavzular bo'yicha darslar, DTM uslubidagi testlar va har bir urinishdan
          keyin sun'iy intellekt yordamida shaxsiy tahlil — qaysi mavzularni
          takrorlash kerakligini aniq ko'rsatadi.
        </p>
        {!user && (
          <Link href="/royxat" className="btn">
            Ro'yxatdan o'tish
          </Link>
        )}
        {user && (
          <Link href="/dashboard" className="btn">
            Kursga o'tish
          </Link>
        )}
      </div>

      <div className="card">
        <h3>Qanday ishlaydi?</h3>
        <ol>
          <li>Ro'yxatdan o'tasiz va kurs uchun to'lov qilasiz.</li>
          <li>Admin to'lovni tasdiqlagach, barcha mavzular ochiladi.</li>
          <li>Har bir mavzuni o'qib, testdan o'tasiz.</li>
          <li>
            Natija sahifasida sun'iy intellekt xatolaringizni tahlil qilib,
            tushuntirib beradi.
          </li>
        </ol>
      </div>
    </div>
  );
}
