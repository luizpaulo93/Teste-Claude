import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { visibleLives } from '@/lib/live';
import { getSettings, getViewer } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer) redirect('/auth/expirado');

  // Tudo vem do cache ou da consulta única do usuário: nenhuma consulta extra por página
  const liveNow = viewer.isMember && (await visibleLives(viewer, ['live'])).length > 0;

  return (
    <AppShell
      brand={settings.brand_name}
      user={{ name: viewer.profile.full_name || viewer.email, email: viewer.email, avatar: viewer.profile.avatar_url }}
      isAdmin={viewer.isAdmin}
      isMember={viewer.isMember}
      hasMentoria={viewer.hasMentoria}
      liveNow={liveNow}
    >
      {children}
    </AppShell>
  );
}
