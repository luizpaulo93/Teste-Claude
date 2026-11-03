'use client';

import { CheckCircle2, Eye, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { answerQuestion } from '@/app/(app)/questoes/actions';
import { answerInList } from '@/app/(app)/questoes/list-actions';
import { toast } from '@/components/toast';
import { Button } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import type { QImg } from '@/lib/question-types';
import { cn } from '@/lib/utils';
import { QImage } from './q-image';

export interface AltView {
  letra: string;
  html: string;
  imagem: QImg | null;
}
export interface Reveal {
  letter: string;
  gabarito: string;
  correct: boolean | null;
  resolucao: string;
}

/**
 * Alternativas clicáveis. O aluno escolhe, confirma e só então vê o gabarito e a resolução.
 * Modo professor (admin): já abre com o gabarito e a resolução.
 */
export function Answer({
  id,
  alts,
  status,
  initial,
  teacher,
  listId,
  test,
  savedLetter = '',
}: {
  id: string;
  alts: AltView[];
  status: 'valida' | 'anulada' | 'abandonado_na_calibracao';
  initial: Reveal | null;
  teacher: boolean;
  /** questão dentro de uma lista (conta na lista e no banco) */
  listId?: string;
  /** teste: só guarda a resposta; o gabarito aparece quando o aluno finalizar */
  test?: boolean;
  savedLetter?: string;
}) {
  const [pick, setPick] = useState(initial?.letter ?? savedLetter);
  const [shown, setShown] = useState<Reveal | null>(initial);
  const [saved, setSaved] = useState(savedLetter);
  const [busy, setBusy] = useState(false);
  const anulada = status === 'anulada' && !test;
  const locked = Boolean(shown) || anulada;

  async function send(letter: string) {
    setBusy(true);
    const r = await (listId ? answerInList(listId, id, letter) : answerQuestion(id, letter)).catch(() => ({ error: 'Sem conexão. Tente de novo.' }));
    setBusy(false);
    if ('error' in r && r.error) return toast.error(r.error);
    if ('saved' in r) {
      setSaved(letter);
      return toast(`Resposta ${letter} guardada`);
    }
    const ok = r as { gabarito?: string; correct?: boolean | null; resolucao?: string };
    setShown({ letter, gabarito: ok.gabarito ?? '', correct: ok.correct ?? null, resolucao: ok.resolucao ?? '' });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {alts.map((a) => {
          const isKey = Boolean(shown?.gabarito) && a.letra === shown!.gabarito;
          const isMine = a.letra === (shown ? shown.letter : pick);
          const wrong = Boolean(shown) && isMine && !isKey && !teacher;
          return (
            <li key={a.letra}>
              <button
                type="button"
                disabled={locked || busy}
                onClick={() => setPick(a.letra)}
                aria-pressed={isMine}
                aria-label={`Alternativa ${a.letra}`}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-default',
                  isKey
                    ? 'border-success bg-success/10'
                    : wrong
                      ? 'border-danger bg-danger/10'
                      : isMine
                        ? 'border-brand bg-brand/8'
                        : 'border-line hover:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full border text-sm font-bold',
                    isKey
                      ? 'border-success bg-success text-white'
                      : wrong
                        ? 'border-danger bg-danger text-white'
                        : isMine
                          ? 'border-brand bg-brand text-white'
                          : 'border-line-strong text-ink-2',
                  )}
                >
                  {a.letra}
                </span>
                <span className="min-w-0 flex-1 space-y-2 pt-1">
                  {a.html && <span className="q-rich block text-[15px] text-ink-2" dangerouslySetInnerHTML={{ __html: a.html }} />}
                  {a.imagem && <QImage img={a.imagem} className="mx-0" />}
                </span>
                {isKey && <CheckCircle2 className="mt-1.5 size-5 shrink-0 text-success" />}
                {wrong && <XCircle className="mt-1.5 size-5 shrink-0 text-danger" />}
              </button>
            </li>
          );
        })}
      </ul>

      {!shown && !anulada && (
        <Button
          onClick={() => send(pick)}
          disabled={!pick || busy || (test && pick === saved)}
          variant={test && pick === saved ? 'secondary' : 'primary'}
          className="w-full"
        >
          {busy && <Spinner />}{' '}
          {test && saved && pick === saved
            ? `Resposta ${saved} guardada`
            : test && saved
              ? `Trocar para ${pick}`
              : pick
                ? `Responder ${pick}`
                : 'Escolha uma alternativa'}
        </Button>
      )}
      {!shown && anulada && (
        <Button variant="secondary" onClick={() => send('')} disabled={busy} className="w-full">
          {busy ? <Spinner /> : <Eye className="size-4" />} Ver resolução
        </Button>
      )}

      {shown && (
        <div className="space-y-3">
          {!teacher && shown.correct !== null && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-2xl p-3 text-sm font-bold',
                shown.correct ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger',
              )}
            >
              {shown.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
              {shown.correct ? 'Você acertou!' : `Resposta certa: ${shown.gabarito}`}
              {!listId && (
                <button
                  type="button"
                  onClick={() => {
                    setShown(null);
                    setPick('');
                  }}
                  className="ml-auto flex items-center gap-1 text-xs font-semibold text-ink-2"
                >
                  <RotateCcw className="size-3.5" /> Refazer
                </button>
              )}
            </div>
          )}
          {shown.resolucao && (
            <section className="rounded-2xl border border-line bg-surface p-4">
              <p className="mb-2 text-xs font-bold tracking-wider text-brand uppercase">Resolução</p>
              <div className="q-rich text-[15px] text-ink-2" dangerouslySetInnerHTML={{ __html: shown.resolucao }} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
