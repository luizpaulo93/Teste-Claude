import { requireAdmin } from '@/lib/session';
import { pendingDoubts } from '@/lib/mentoria-space';
import { AdminNav } from './admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const alert = [...(await pendingDoubts()).values()].reduce((a, b) => a + b, 0);
  return (
    <>
      <AdminNav mentoriaAlert={alert} />
      <div className="animate-fade-in">{children}</div>
    </>
  );
}
