import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listSubjects, listTopicsBySubject, listPendingPayments } from '@/lib/db';
import AdminForms from './AdminForms';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');

  const subjects = await listSubjects();
  const subjectsWithTopics = await Promise.all(
    subjects.map(async (s) => ({ subject: s, topics: await listTopicsBySubject(s.id) }))
  );
  const pendingPayments = await listPendingPayments();

  return (
    <div>
      <h1>Admin panel</h1>
      <AdminForms subjectsWithTopics={subjectsWithTopics} pendingPayments={pendingPayments} />
    </div>
  );
}
