'use client';

import { CheckCircle2, Download, Flag, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { finishList, restartList } from '@/app/(app)/questoes/list-actions';
import { usePdfOwner } from '@/components/pdf-owner';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { stampedPdfUrl } from '@/lib/pdf-stamp';

/** Baixar a lista em PDF sem sair da página (com nome, e-mail, CPF e telefone do aluno em cada folha). */
export function ListPdfButton({ id, title }: { id: string; title: string }) {
  const owner = usePdfOwner();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    toast('Gerando o PDF…');
    try {
      const url = await stampedPdfUrl(`/api/listas/${id}/arquivo?formato=pdf`, owner);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[\\/:*?"<>|]/g, '').trim() || 'lista'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('Não foi possível gerar o PDF agora.');
    }
    setBusy(false);
  }
  return (
    <Button variant="secondary" size="sm" onClick={go} disabled={busy}>
      {busy ? <Spinner /> : <Download className="size-4" />} Baixar PDF
    </Button>
  );
}

export function FinishButton({ id, answered, total }: { id: string; answered: number; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      onClick={async () => {
        if (answered < total && !confirm(`Você respondeu ${answered} de ${total}. Finalizar mesmo assim?`)) return;
        setBusy(true);
        await finishList(id).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
      disabled={busy}
      className="w-full"
    >
      {busy ? <Spinner /> : <Flag className="size-4" />} Finalizar e ver o resultado
    </Button>
  );
}

export function RestartButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!confirm('Recomeçar a lista? Suas respostas nela serão apagadas.')) return;
        setBusy(true);
        await restartList(id).catch(() => null);
        setBusy(false);
        router.refresh();
      }}
      disabled={busy}
    >
      {busy ? <Spinner /> : <RotateCcw className="size-4" />} Recomeçar
    </Button>
  );
}

export const Done = ({ n, total }: { n: number; total: number }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
    <CheckCircle2 className="size-3.5" /> {n} de {total}
  </span>
);
