import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { emailKey, sql } from '@/lib/db';
import { visibleLives } from '@/lib/live';
import { getSettings, getViewer } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer) redirect('/auth/expirado');

  let hasMentoria = viewer.isAdmin;
  let liveNow = false;
  if (viewer.isMember) {
    const [m, lives] = await Promise.all([
      hasMentoria ? Promise.resolve(null) : sql.one<{ status: string }>(`select status from mentorias where id = $1`, [emailKey(viewer.email)]),
      visibleLives(viewer, ['live']),
    ]);
    if (!hasMentoria) hasMentoria = m?.status === 'active';
    liveNow = lives.length > 0;
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
