import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { getSettings, getViewer } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer) redirect('/login');

  let hasMentoria = viewer.isAdmin;
  let liveNow = false;
  if (viewer.isMember) {
    const supabase = await createClient();
    const [{ data: m }, { data: l }] = await Promise.all([
      hasMentoria ? Promise.resolve({ data: [1] }) : supabase.from('mentorias').select('id').eq('status', 'active').limit(1),
      supabase.from('live_sessions').select('id').eq('status', 'live').eq('is_published', true).limit(1),
    ]);
    hasMentoria = Boolean(m?.length);
    liveNow = Boolean(l?.length);
  }

  return (
    <AppShell
      brand={settings.brand_name}
      user={{ name: viewer.profile.full_name || viewer.email, email: viewer.email, avatar: viewer.profile.avatar_url }}
      isAdmin={viewer.isAdmin}
      isMember={viewer.isMember}
      hasMentoria={hasMentoria}
      liveNow={liveNow}
    >
      {children}
    </AppShell>
  );
}
