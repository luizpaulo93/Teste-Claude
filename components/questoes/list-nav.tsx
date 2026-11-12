'use client';

import { AlertTriangle, ChevronLeft, ChevronRight, Flag, Grid3x3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { finishList } from '@/app/(app)/questoes/list-actions';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { cn } from '@/lib/utils';

export interface NavItem {
  n: number;
  id: string;
  state: 'certa' | 'errada' | 'respondida' | 'nao';
  /** anulada não conta como "em branco" */
  anulada?: boolean;
}

/** Abre o quadro das questões já no aviso de finalizar (usado pelo botão do fim da página). */
export const askFinish = () => window.dispatchEvent(new Event('qfinish'));

/**
 * Navegação da lista: voltar/avançar uma questão e um quadro com todas as questões (toque leva até ela).
 * No teste, o quadro tem o botão Finalizar: avisa quais ficaram em branco antes de confirmar.
 */
export function ListNav({ items, finishId }: { items: NavItem[]; finishId?: string }) {
  const router = useRouter();
  const [cur, setCur] = useState(1);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState(() => new Map(items.map((i) => [i.id, i.state])));

  // questão que está na tela agora
  useEffect(() => {
    const onScroll = () => {
      let n = 1;
      for (const it of items) {
        const el = document.getElementById(`q${it.n}`);
        if (el && el.getBoundingClientRect().top < 160) n = it.n;
      }
      setCur(n);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  // marca as respondidas na hora (a resposta avisa por evento)
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; correct: boolean | null }>).detail;
      setStates((m) => new Map(m).set(d.id, d.correct === null ? 'respondida' : d.correct ? 'certa' : 'errada'));
    };
    const ask = () => {
      setConfirm(true);
      setOpen(true);
    };
    window.addEventListener('qanswer', on);
    window.addEventListener('qfinish', ask);
    return () => {
      window.removeEventListener('qanswer', on);
      window.removeEventListener('qfinish', ask);
    };
  }, []);

  const close = () => {
    setOpen(false);
    setConfirm(false);
  };
  const go = (n: number) => {
    const k = Math.min(items.length, Math.max(1, n));
    setCur(k);
    close();
    // espera o popup fechar (ele trava a rolagem da página) antes de rolar até a questão
    setTimeout(() => document.getElementById(`q${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const blanks = items.filter((it) => !it.anulada && (states.get(it.id) ?? 'nao') === 'nao').map((it) => it.n);

  async function finish() {
    if (!finishId) return;
    setBusy(true);
    const r = await finishList(finishId).catch(() => ({ error: 'Sem conexão. Tente de novo.' }));
    setBusy(false);
    if (r && 'error' in r && r.error) return toast.error(r.error);
    close();
    const ck = r && 'check' in r ? r.check : null;
    toast(
      ck
        ? ck.passed
          ? `Verificação: ${ck.ok}/${ck.total}. Assunto aprendido!`
          : ck.next
            ? `Verificação: ${ck.ok}/${ck.total}. Revise o assunto: uma nova lista foi criada na Mentoria.`
            : `Verificação: ${ck.ok}/${ck.total}. Fale com o seu mentor sobre este assunto.`
        : 'Finalizado! Veja o que você acertou e errou.',
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
    router.refresh();
  }

  const tone = (s: NavItem['state'] | undefined) =>
    s === 'certa'
      ? 'border-success bg-success/15 text-success'
      : s === 'errada'
        ? 'border-danger bg-danger/15 text-danger'
        : s === 'respondida'
          ? 'border-brand bg-brand/15 text-brand'
          : 'border-line text-ink-2';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => go(cur - 1)}
        disabled={cur <= 1}
        aria-label="Questão anterior"
        className="grid size-9 place-items-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Todas as questões"
        className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-xs font-bold text-ink tabular-nums hover:bg-surface-2"
      >
        <Grid3x3 className="size-4 text-brand" /> {cur}/{items.length}
      </button>
      <button
        type="button"
        onClick={() => go(cur + 1)}
        disabled={cur >= items.length}
        aria-label="Próxima questão"
        className="grid size-9 place-items-center rounded-xl border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
      <Modal
        open={open}
        onClose={close}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Questões
            {finishId && !confirm && (
              <Button size="sm" onClick={() => setConfirm(true)}>
                <Flag className="size-4" /> Finalizar
              </Button>
            )}
          </span>
        }
      >
        {confirm && finishId ? (
          <div className="space-y-4">
            {blanks.length > 0 ? (
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3.5">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <AlertTriangle className="size-4 shrink-0 text-warning" />
                  {blanks.length === 1 ? '1 questão em branco' : `${blanks.length} questões em branco`}
                </p>
                <p className="mt-1 text-xs text-ink-2">Toque no número para ir até ela, ou confirme para finalizar assim mesmo.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {blanks.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => go(n)}
                      aria-label={`Ir para a questão em branco ${n}`}
                      className="grid h-9 min-w-9 place-items-center rounded-lg border border-warning/50 px-2 text-sm font-bold text-ink"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-2">Todas as questões foram respondidas.</p>
            )}
            <p className="text-xs text-muted">Depois de finalizar não dá para mudar as respostas. Você vê na hora o que acertou e o que errou.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
                Voltar
              </Button>
              <Button onClick={finish} disabled={busy}>
                {busy ? <Spinner /> : <Flag className="size-4" />} Confirmar e finalizar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => go(it.n)}
                  aria-label={`Ir para a questão ${it.n}`}
                  className={cn(
                    'grid h-11 place-items-center rounded-xl border text-sm font-bold',
                    tone(states.get(it.id)),
                    it.n === cur && 'ring-2 ring-brand',
                  )}
                >
                  {it.n}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
              {finishId ? (
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded border border-brand bg-brand/15" /> marcada
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <span className="size-3 rounded border border-success bg-success/15" /> certa
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-3 rounded border border-danger bg-danger/15" /> errada
                  </span>
                </>
              )}
              <span className="flex items-center gap-1">
                <span className="size-3 rounded border border-line" /> sem resposta
              </span>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
