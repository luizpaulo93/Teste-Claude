'use client';

import { RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { newCycle, newGroupCycle } from '@/app/(app)/admin/mentoria/cycle-actions';
import { toast } from '@/components/toast';
import { Button, Field, Input } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { ScopePicker, type MentoriaScope } from './scope-picker';

/**
 * Começa um ciclo novo (ex.: depois da 1ª avaliação). O atual fica salvo em "Anteriores" para o
 * aluno acessar quando quiser, e o novo vira a página inicial da mentoria.
 */
export function NewCycleButton({ mentoriaId, groupId, scope }: { mentoriaId?: string; groupId?: string; scope?: MentoriaScope }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ title: '', exam_date: '', start_date: new Date().toISOString().slice(0, 10), end_date: '', scope: scope ?? ('completa' as MentoriaScope) });
  async function save() {
    setBusy(true);
    const r = groupId ? await newGroupCycle(groupId, v) : await newCycle(mentoriaId!, v);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast('Novo ciclo começado. O anterior ficou salvo em Anteriores.');
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <RefreshCcw className="size-3.5" /> Novo ciclo
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo ciclo da mentoria"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Spinner />} Começar novo ciclo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-surface-2/60 p-3 text-xs text-ink-2">
            Tudo o que foi feito até agora (assuntos, o que estudou em cada dia, acertos e apostilas) fica salvo em <strong>Anteriores</strong>
            {groupId ? ' para cada aluno do grupo' : ''}. O novo ciclo vira a página inicial da mentoria.
          </p>
          <Field label="Nome do novo ciclo / prova">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} placeholder="Ex.: 2ª avaliação" />
          </Field>
          <ScopePicker value={v.scope} onChange={(s) => setV({ ...v, scope: s })} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Início">
              <Input type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} />
            </Field>
            <Field label="Prova">
              <Input type="date" value={v.exam_date} onChange={(e) => setV({ ...v, exam_date: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
