'use client';

import { Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QuestionPicker } from '@/components/questoes/picker';
import { toast } from '@/components/toast';
import { Button, Input } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { deleteManyQuestions } from '../bank-actions';

/** Filtra, marca várias (ou todas do filtro) e exclui de uma vez, confirmando com a palavra "excluir". */
export function BulkDelete() {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  async function run() {
    setBusy(true);
    const r = await deleteManyQuestions([...sel], word).catch(() => ({ error: 'Não foi possível excluir.' }));
    setBusy(false);
    if ('error' in r && r.error) return toast.error(r.error);
    toast(`${'deleted' in r ? r.deleted : 0} questões excluídas`);
    setSel(new Set());
    setAsk(false);
    setWord('');
    setKey((k) => k + 1); // recarrega a busca
    router.refresh();
  }

  return (
    <div className="pb-24">
      <QuestionPicker
        key={key}
        selected={sel}
        manyLabel="Marcar todas"
        onToggle={(it) =>
          setSel((s) => {
            const n = new Set(s);
            if (n.has(it.id)) n.delete(it.id);
            else n.add(it.id);
            return n;
          })
        }
        onMany={(ids) => setSel((s) => new Set([...s, ...ids]))}
      />
      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{sel.size} marcadas</span>
            <Button variant="ghost" size="sm" onClick={() => setSel(new Set())}>
              <X className="size-4" /> Desmarcar
            </Button>
            <Button size="sm" className="!bg-danger hover:!bg-danger/90" onClick={() => setAsk(true)}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          </div>
        </div>
      )}
      <Modal
        open={ask}
        onClose={() => setAsk(false)}
        title={`Excluir ${sel.size} ${sel.size === 1 ? 'questão' : 'questões'}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(false)}>
              Cancelar
            </Button>
            <Button onClick={run} disabled={busy || word.trim().toLowerCase() !== 'excluir'} className="!bg-danger hover:!bg-danger/90">
              {busy ? <Spinner /> : <Trash2 className="size-4" />} Excluir de vez
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-2">
          <p>As questões saem do banco, das listas onde estavam e as respostas dos alunos nelas são apagadas. Não dá para desfazer.</p>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">
              Digite <strong className="text-danger">excluir</strong> para confirmar
            </span>
            <Input value={word} onChange={(e) => setWord(e.target.value)} autoFocus aria-label="Confirmação" placeholder="excluir" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
