'use client';

import { CheckCircle2, Download, Flag, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { restartList } from '@/app/(app)/questoes/list-actions';
import { askFinish } from './list-nav';
import { usePdfOwner } from '@/components/pdf-owner';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui';
import { ActionButton, Spinner } from '@/components/ui-client';
import { fetchFile, safeName, saveBlob } from '@/lib/download';
import { stampedPdfUrl } from '@/lib/pdf-stamp';

/** Baixar a lista em PDF sem sair da página (com nome, e-mail, CPF e telefone do aluno em cada folha). */
export function ListPdfButton({ id, title }: { id: string; title: string }) {
  const owner = usePdfOwner();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    toast('Gerando o PDF…');
    try {
      const blob = await fetchFile(`/api/listas/${id}/arquivo?formato=pdf`, 'pdf');
      const local = URL.createObjectURL(blob);
      // cada página sai com nome, e-mail, CPF e telefone de quem baixou
      saveBlob(await stampedPdfUrl(local, owner), safeName(title, 'pdf'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PDF agora.');
    }
    setBusy(false);
  }
  return (
    <Button variant="secondary" size="sm" onClick={go} disabled={busy}>
      {busy ? <Spinner /> : <Download className="size-4" />} Baixar PDF
    </Button>
  );
}

/** Botão do fim da página: abre o quadro das questões no aviso de finalizar (mostra as que ficaram em branco). */
export function FinishButton() {
  return (
    <Button onClick={askFinish} className="w-full">
      <Flag className="size-4" /> Finalizar e ver o resultado
    </Button>
  );
}

/** Refazer: pode quantas vezes quiser, mas só a 1ª tentativa conta nas estatísticas. */
export function RestartButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionButton
      action={async () => {
        const r = await restartList(id).catch(() => ({ error: 'Sem conexão. Tente de novo.' }));
        router.refresh();
        return r;
      }}
      confirm="Você pode refazer quantas vezes quiser, mas só a PRIMEIRA tentativa conta para as suas estatísticas (Desempenho e banco de questões). As respostas desta tentativa serão apagadas."
      success="Nova tentativa: esta não conta nas estatísticas"
      variant="ghost"
      size="sm"
    >
      <RotateCcw className="size-4" /> Refazer
    </ActionButton>
  );
}

export const Done = ({ n, total }: { n: number; total: number }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
    <CheckCircle2 className="size-3.5" /> {n} de {total}
  </span>
);
