import type { Metadata } from 'next';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/session';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Meu perfil' };

export default async function ProfilePage() {
  const viewer = await requireViewer();
  const p = viewer.profile;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Meu perfil" />
      <Card className="mb-6 flex items-center gap-4 p-5">
        <Avatar name={p.full_name || viewer.email} src={p.avatar_url} size={64} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink">{p.full_name || 'Sem nome'}</p>
          <p className="truncate text-sm text-muted">{viewer.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {viewer.isAdmin && <Badge tone="brand">Administrador</Badge>}
            {viewer.classGroup && <Badge>{viewer.classGroup.name}</Badge>}
            <Badge tone={viewer.isMember ? 'success' : 'warning'}>{viewer.isMember ? 'Acesso liberado' : 'Acesso pendente'}</Badge>
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <ProfileForm profile={p} email={viewer.email} cpf={viewer.student?.cpf || p.cpf || ''} />
      </Card>
    </div>
  );
}
