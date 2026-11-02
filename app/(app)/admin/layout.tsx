import { requireAdmin } from '@/lib/session';

/** O menu de cima do admin fica no layout geral (aparece também em Desempenho e Calendário). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="animate-fade-in">{children}</div>;
}
