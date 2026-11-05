import { redirect } from 'next/navigation';
import { PdfOwnerProvider } from '@/components/pdf-owner';
import { AppShell } from '@/components/shell/app-shell';
import { AdminNav } from './admin/admin-nav';
import { CompleteProfile } from './perfil/complete-profile';
import { visibleLives } from '@/lib/live';
import { pendingDoubts } from '@/lib/mentoria-space';
import { ensureTaxonomy } from '@/lib/questions';
import { newsFor } from '@/lib/seen';
import { getSettings, getViewer } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (!viewer) redirect('/auth/expirado');
  // uma vez por servidor: questões já cadastradas passam para a taxonomia de assuntos
  if (viewer.isMember || viewer.isAdmin) await ensureTaxonomy();

  // Tudo vem do cache ou da consulta única do usuário: nenhuma consulta extra por página
  const liveNow = (await visibleLives(viewer, ['live'])).length > 0;
  // Mentor: aviso de dúvidas da mentoria sem resposta
  const mentoriaAlert = viewer.isAdmin ? [...(await pendingDoubts()).values()].reduce((a, b) => a + b, 0) : 0;
  // Aluno: bolinha vermelha quando há simulado novo ou evento novo no calendário
  const news = viewer.isMember && !viewer.isAdmin ? await newsFor(viewer.userId) : { simulados: false, calendario: false };

  return (
    <AppShell
      brand={settings.brand_name}
      user={{ name: viewer.profile.full_name || viewer.email, email: viewer.email, avatar: viewer.profile.avatar_url }}
      isAdmin={viewer.isAdmin}
      isMember={viewer.isMember}
      hasMentoria={viewer.hasMentoria}
      liveNow={liveNow}
      mentoriaAlert={mentoriaAlert}
      news={news}
    >
      {viewer.isAdmin && <AdminNav mentoriaAlert={mentoriaAlert} />}
      <PdfOwnerProvider owner={viewer.pdfOwner}>
        {viewer.needsProfile ? (
          <CompleteProfile
            profile={{ full_name: viewer.profile.full_name, birth_date: viewer.profile.birth_date }}
            email={viewer.email}
            cpfLocked={viewer.student?.cpf || viewer.profile.cpf || ''}
          />
        ) : (
          children
        )}
      </PdfOwnerProvider>
    </AppShell>
  );
}
