'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { ActionButton, Modal } from '@/components/ui-client';
import { deleteGroup } from '../../group-actions';
import { GroupForm, type GroupFormData } from '../../group-form';
import { NewCycleButton } from '@/components/mentoria/new-cycle';

export function GroupAdminActions({
  group,
  students,
  classes,
}: {
  group: GroupFormData & { id: string };
  students: { email: string; name: string; class_id: string | null }[];
  classes: { id: string; name: string; count: number }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <NewCycleButton groupId={group.id} scope={group.scope} />
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" /> Editar
      </Button>
      <ActionButton
        action={async () => {
          const r = await deleteGroup(group.id);
          if (!r.error) router.push('/admin/mentoria');
          return r;
        }}
        confirm="Excluir a mentoria em grupo? Os cronogramas criados por ela e as dúvidas do grupo serão apagados."
        success="Grupo excluído"
        variant="danger"
        size="sm"
      >
        <Trash2 className="size-3.5" /> Excluir
      </ActionButton>
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar mentoria em grupo" size="lg">
        {editing && <GroupForm group={group} students={students} classes={classes} onDone={() => setEditing(false)} />}
      </Modal>
    </div>
  );
}
