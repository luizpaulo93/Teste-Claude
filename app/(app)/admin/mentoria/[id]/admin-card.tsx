'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { ActionButton, Modal } from '@/components/ui-client';
import type { Mentoria } from '@/lib/types';
import { deleteMentoria } from '../../misc-actions';
import { MentoriaForm } from '../mentoria-form';
import { NewCycleButton } from '@/components/mentoria/new-cycle';

/** Dados do mentorado: editar ou excluir. */
export function MentoriaAdminCard({ mentoria }: { mentoria: Mentoria }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{mentoria.student_email}</p>
        <p className="text-xs text-muted">{mentoria.status === 'active' ? 'Mentoria ativa' : mentoria.status === 'paused' ? 'Pausada' : 'Encerrada'}</p>
      </div>
      {!(mentoria as Mentoria & { group_id?: string | null }).group_id && <NewCycleButton mentoriaId={mentoria.id} scope={mentoria.scope} />}
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" /> Editar
      </Button>
      <ActionButton
        action={async () => {
          const r = await deleteMentoria(mentoria.id);
          if (!r.error) router.push('/admin/mentoria');
          return r;
        }}
        confirm="Excluir esta mentoria e todo o cronograma?"
        success="Mentoria excluída"
        variant="danger"
        size="sm"
      >
        <Trash2 className="size-3.5" /> Excluir
      </ActionButton>
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar mentoria" size="lg">
        <MentoriaForm mentoria={mentoria} onSaved={() => setEditing(false)} />
      </Modal>
    </Card>
  );
}
