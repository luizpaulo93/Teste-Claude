import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { visibleLives } from '@/lib/live';
import { pendingDoubts } from '@/lib/mentoria-space';
import { getSettings, getViewer } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer) redirect('/auth/expirado');

  // Tudo vem do cache ou da consulta única do usuário: nenhuma consulta extra por página
  const liveNow = (await visibleLives(viewer, ['live'])).length > 0;
  // Mentor: aviso de dúvidas da mentoria sem resposta
  const mentoriaAlert = viewer.isAdmin ? [...(await pendingDoubts()).values()].reduce((a, b) => a + b, 0) : 0;

  return (
    <AppShell
      brand={settings.brand_name}
      user={{ name: viewer.profile.full_name || viewer.email, email: viewer.email, avatar: viewer.profile.avatar_url }}
      isAdmin={viewer.isAdmin}
      isMember={viewer.isMember}
      hasMentoria={viewer.hasMentoria}
      liveNow={liveNow}
      mentoriaAlert={mentoriaAlert}
    >
      {children}
    </AppShell>
  );
}
