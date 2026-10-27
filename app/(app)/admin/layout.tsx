import { requireAdmin } from '@/lib/session';
import { AdminNav } from './admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminNav />
      <div className="animate-fade-in">{children}</div>
    </>
  );
}
