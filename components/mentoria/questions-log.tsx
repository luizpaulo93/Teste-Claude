'use client';

import { ListChecks } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Input, Select } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { logSession } from '@/app/(app)/mentoria/actions';
import { SUBJECTS } from '@/lib/mentoria';

/** Registro rápido de questões feitas e acertos (alimenta o % de acerto por matéria). */
export function QuestionsLog({ mentoriaId }: { mentoriaId?: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [q, setQ] = useState('');
  const [c, setC] = useState('');
  const [busy, setBusy] = useState(false);
  const total = Number(q) || 0;
  const right = Math.min(total, Number(c) || 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!total) return toast.error('Informe quantas questões fez.');
    setBusy(true);
    const r = await logSession({ subject, minutes: 0, questions: total, correct: right }, mentoriaId);
    setBusy(false);
    if (r.error) return toast.error(r.error);
    toast(`${right}/${total} em ${subject} registrados`);
    setQ('');
    setC('');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <ListChecks className="size-4 text-brand" /> Registrar questões
      </p>
      <Select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Matéria">
        {SUBJECTS.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Feitas" aria-label="Questões feitas" />
        <Input value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Acertos" aria-label="Acertos" />
      </div>
      <button type="submit" disabled={busy} className={buttonClass('secondary', 'md', 'w-full')}>
        {busy && <Spinner />} Salvar{total ? ` · ${Math.round((right / total) * 100)}%` : ''}
      </button>
    </form>
  );
}
