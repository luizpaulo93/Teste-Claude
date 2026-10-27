import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getSettings, getViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer) redirect('/login');

  let hasMentoria = viewer.isAdmin;
  if (!hasMentoria && viewer.isMember) {
    const supabase = await createClient();
    const { data } = await supabase.from('mentorias').select('id').eq('status', 'active').limit(1);
    hasMentoria = Boolean(data?.length);
  }

  return (
    <AppShell
      brand={settings.brand_name}
      user={{ name: viewer.profile.full_name || viewer.email, email: viewer.email, avatar: viewer.profile.avatar_url }}
      isAdmin={viewer.isAdmin}
      isMember={viewer.isMember}
      hasMentoria={hasMentoria}
    >
      {children}
    </AppShell>
  );
}
