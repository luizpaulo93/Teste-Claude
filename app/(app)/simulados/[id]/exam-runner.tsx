'use client';

import { AlertTriangle, CheckCircle2, Clock, CloudOff, FileText, ListChecks, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Card } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { useStampedPdf, type PdfOwner } from '@/lib/pdf-stamp';
import { finishSimulado, saveAnswers } from '../actions';
import type { Simulado, SimuladoSubmission } from '@/lib/types';
import { cn, formatClock } from '@/lib/utils';

const OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const;

export function ExamRunner({
  simulado,
  submission,
  pdfUrl: rawPdf,
  pdfOwner,
  serverNow,
}: {
  simulado: Simulado;
  submission: SimuladoSubmission;
  pdfUrl: string;
  pdfOwner?: PdfOwner | null;
  serverNow: number;
}) {
  const router = useRouter();
  // Caderno com nome e CPF do aluno em todas as páginas
  const stamped = useStampedPdf(rawPdf, pdfOwner);
  const pdfUrl = rawPdf;
  const n = simulado.question_count;
  const [answers, setAnswers] = useState(() => (submission.answers || '').padEnd(n, '-').slice(0, n));
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [tab, setTab] = useState<'prova' | 'cartao'>(pdfUrl ? 'prova' : 'cartao');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const clockOffset = useRef(serverNow - Date.now());
  const pending = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const startedMs = new Date(submission.started_at).getTime();
  const limitMs = simulado.time_limit_minutes * 60_000;
  const [now, setNow] = useState(() => Date.now() + clockOffset.current);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => window.clearInterval(t);
  }, []);

  const flush = useCallback(async () => {
    if (pending.current === null) return;
    const value = pending.current;
    pending.current = null;
    setSaveState('saving');
    let r: Awaited<ReturnType<typeof saveAnswers>>;
    try {
      r = await saveAnswers(simulado.id, value);
    } catch {
      r = { error: 'rede' };
    }
    if (r && 'completed' in r && r.completed) {
      finishedRef.current = true;
      toast.error(r.error ?? 'Prova entregue.');
      router.refresh();
      return;
    }
    if (r?.error) {
      pending.current = pending.current ?? value;
      setSaveState('error');
    } else if (pending.current === null) setSaveState('saved');
  }, [simulado.id, router]);

  const queueSave = useCallback(
    (value: string) => {
      pending.current = value;
      setSaveState('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 900);
    },
    [flush],
  );

  // Salva ao sair da aba / fechar
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    const retry = window.setInterval(() => {
      if (pending.current !== null && navigator.onLine) void flush();
    }, 5000);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.clearInterval(retry);
    };
  }, [flush]);

  const mark = (i: number, opt: string) => {
    if (finishedRef.current) return;
    setAnswers((prev) => {
      const next = prev.slice(0, i) + (prev[i] === opt ? '-' : opt) + prev.slice(i + 1);
      queueSave(next);
      return next;
    });
  };

  const finish = useCallback(
    async (auto = false) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFinishing(true);
      if (timer.current) window.clearTimeout(timer.current);
      let error = '';
      try {
        error = (await finishSimulado(simulado.id, answers)).error ?? '';
      } catch {
        error = 'rede';
      }
      if (error) {
        finishedRef.current = false;
        setFinishing(false);
        return toast.error('Falha ao entregar. Verifique sua internet e tente de novo.');
      }
      toast(auto ? 'Tempo esgotado — prova entregue automaticamente.' : 'Prova entregue com sucesso!');
      router.refresh();
    },
    [answers, simulado.id, router],
  );

  const remaining = limitMs ? startedMs + limitMs - now : null;
  const elapsed = Math.max(0, now - startedMs);

  useEffect(() => {
    if (remaining !== null && remaining <= 0) void finish(true);
  }, [remaining, finish]);

  const answered = [...answers].filter((c) => c !== '-').length;
  const lowTime = remaining !== null && remaining < 5 * 60_000;

  const sheet = (
    <div className={cn('grid grid-cols-1 gap-1.5', pdfUrl ? 'sm:grid-cols-2 lg:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3')}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', answers[i] !== '-' ? 'bg-brand-soft/60' : 'bg-surface-2/50')}>
          <span className="w-7 text-right text-xs font-bold text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
          <div className="flex flex-1 justify-between gap-1 sm:justify-start sm:gap-1.5">
            {OPTIONS.map((o) => {
              const on = answers[i] === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => mark(i, o)}
                  aria-label={`Questão ${i + 1}, alternativa ${o}`}
                  aria-pressed={on}
                  className={cn(
                    'grid size-8 place-items-center rounded-full border text-xs font-bold transition-all active:scale-90',
                    on ? 'border-brand bg-brand text-white shadow-[0_0_0_3px_var(--brand-soft)]' : 'border-line-strong text-ink-2 hover:border-brand hover:text-brand',
                  )}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Barra fixa com tempo e progresso */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border lg:top-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{simulado.title}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span>
                {answered}/{n} respondidas
              </span>
              <span className="flex items-center gap-1">
                {saveState === 'saving' && (
                  <>
                    <Spinner className="size-3" /> salvando
                  </>
                )}
                {saveState === 'saved' && (
                  <>
                    <CheckCircle2 className="size-3 text-success" /> salvo
                  </>
                )}
                {saveState === 'error' && (
                  <>
                    <CloudOff className="size-3 text-danger" /> sem conexão
                  </>
                )}
              </span>
            </div>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold tabular-nums',
              lowTime ? 'animate-pulse bg-danger/15 text-danger' : 'bg-surface-2 text-ink',
            )}
          >
            <Clock className="size-4" />
            {remaining !== null ? formatClock(Math.max(0, remaining / 1000)) : formatClock(elapsed / 1000)}
          </div>
          <button type="button" onClick={() => setConfirmOpen(true)} className={buttonClass('primary', 'md', 'hidden sm:inline-flex')}>
            <Send className="size-4" /> Entregar
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full bg-brand transition-all" style={{ width: `${(answered / n) * 100}%` }} />
        </div>
      </div>

      {/* Abas no celular */}
      {pdfUrl && (
        <div className="grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1 lg:hidden">
          {(['prova', 'cartao'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn('flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold', tab === t ? 'bg-surface text-ink shadow-card' : 'text-muted')}
            >
              {t === 'prova' ? <FileText className="size-4" /> : <ListChecks className="size-4" />}
              {t === 'prova' ? 'Prova' : 'Cartão-resposta'}
            </button>
          ))}
        </div>
      )}

      <div className={cn('grid gap-4', pdfUrl && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
        {pdfUrl && (
          <Card className={cn('overflow-hidden', tab !== 'prova' && 'hidden lg:block')}>
            {stamped ? (
              <iframe src={`${stamped}#toolbar=0&navpanes=0&view=FitH`} title="Caderno de questões" className="h-[70dvh] w-full bg-white lg:h-[calc(100dvh-180px)]" />
            ) : (
              <div className="grid h-[70dvh] place-items-center bg-surface-2 lg:h-[calc(100dvh-180px)]">
                <Spinner />
              </div>
            )}
            <a href={stamped || '#'} target="_blank" rel="noopener noreferrer" className="block border-t border-line py-2.5 text-center text-xs font-semibold text-brand lg:hidden">
              Abrir prova em tela cheia
            </a>
          </Card>
        )}
        <Card className={cn('p-3 sm:p-4 lg:sticky lg:top-28 lg:self-start', pdfUrl && tab !== 'cartao' && 'hidden lg:block')}>
          <p className="mb-3 px-1 text-sm font-bold text-ink">Cartão-resposta</p>
          <div className="scrollbar-thin lg:max-h-[calc(100dvh-260px)] lg:overflow-y-auto">{sheet}</div>
        </Card>
      </div>

      <button type="button" onClick={() => setConfirmOpen(true)} className={buttonClass('primary', 'lg', 'w-full sm:hidden')}>
        <Send className="size-4" /> Entregar prova
      </button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Entregar simulado?"
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setConfirmOpen(false)} className={buttonClass('ghost')}>
              Voltar
            </button>
            <button type="button" onClick={() => finish(false)} disabled={finishing} className={buttonClass('primary')}>
              {finishing ? <Spinner /> : <Send className="size-4" />} Entregar
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Você respondeu <strong className="text-ink">{answered}</strong> de <strong className="text-ink">{n}</strong> questões.
        </p>
        {answered < n && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Há {n - answered} questões em branco. Depois de entregar não é possível alterar.
          </p>
        )}
      </Modal>
    </div>
  );
}
