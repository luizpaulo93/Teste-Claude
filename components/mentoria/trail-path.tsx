'use client';

import { ArrowRight, Check, Flame, ListChecks, Play, Plus, RotateCcw, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addToDay } from '@/app/(app)/mentoria/actions';
import { toast } from '@/components/toast';
import { buttonClass } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import type { AssuntoRow } from '@/components/mentoria/assuntos-view';
import { LEVELS } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

export type TrailRow = AssuntoRow & {
  short: string;
  cardId: string | null;
  hard: boolean;
  retained: number;
  size: number;
  nextReview: string | null;
  list: { id: string; answered: number; total: number; round: number } | null;
};

const STAGES = ['Teoria', 'Nível 1', 'Nível 2', 'Nível 3', 'Dominado'];

/**
 * Trilha do aluno: cada assunto passa por teoria, três níveis de listas e fica dominado.
 * No topo, o que está em andamento (com a lista para fazer); embaixo, o caminho completo da disciplina.
 */
export function TrailPath({ rows, disciplines, today }: { rows: TrailRow[]; disciplines: { key: string; name: string }[]; today: string }) {
  const [disc, setDisc] = useState(disciplines[0]?.key ?? '');
  const list = rows.filter((r) => r.discipline === disc && r.level !== null);
  const doing = list.filter((r) => (r.level ?? 0) >= 1 && (r.level ?? 0) <= 3);
  const blocks = [...new Set(list.map((r) => r.block))];
  const count = (l: number) => list.filter((r) => r.level === l).length;

  return (
    <div className="space-y-6">
      <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {disciplines.map((d) => {
          const all = rows.filter((r) => r.discipline === d.key && r.level !== null);
          const pct = all.length ? Math.round((all.filter((r) => r.level === 4).length / all.length) * 100) : 0;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDisc(d.key)}
              aria-pressed={disc === d.key}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
                disc === d.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              {d.name}
              <span className={cn('num text-[11px]', disc === d.key ? 'text-bg/70' : 'text-muted')}>{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* quantos assuntos em cada etapa */}
      <div className="grid grid-cols-5 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {STAGES.map((s, l) => (
          <div key={s} className="bg-surface px-2 py-3 text-center">
            <p className="num text-xl font-medium text-ink">{count(l)}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 font-mono text-[9.5px] tracking-[0.04em] text-muted uppercase">
              <span className={cn('size-1.5 rounded-full', LEVELS[l].dot)} />
              {s}
            </p>
          </div>
        ))}
      </div>

      {doing.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Em andamento</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {doing.map((r) => (
              <li key={r.key} className={cn('rounded-xl border bg-surface p-3.5', r.hard ? 'border-danger/35' : 'border-line')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10.5px] tracking-[0.04em] text-muted uppercase">
                      {STAGES[r.level ?? 0]}
                      {r.list && r.list.round > 1 ? ` · ${r.list.round}ª lista` : ''}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-ink">{r.short}</p>
                  </div>
                  <Steps level={r.level ?? 0} />
                </div>
                {r.list ? (
                  <Link href={`/listas/${r.list.id}`} className={buttonClass('primary', 'sm', 'mt-3 w-full')}>
                    <ListChecks className="size-3.5" /> {r.list.answered ? `Continuar (${r.list.answered}/${r.list.total})` : `Fazer lista · ${r.list.total} questões`}
                    <ArrowRight className="size-3.5" />
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-warning">Aguardando questões deste nível no banco.</p>
                )}
                {r.retained > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
                    <RotateCcw className="size-3" /> Para passar: acertar mais da metade.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-5">
        {blocks.map((b) => (
          <div key={b}>
            <h3 className="mb-2 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">{b}</h3>
            <ol className="relative space-y-1.5 border-l border-line pl-5">
              {list
                .filter((r) => r.block === b)
                .map((r) => (
                  <PathItem key={r.key} r={r} today={today} />
                ))}
            </ol>
          </div>
        ))}
        {!list.length && <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">Nenhum assunto desta disciplina na sua trilha.</p>}
      </section>
    </div>
  );
}

/** Três degraus (níveis 1 a 3): preenchidos até onde o aluno chegou */
function Steps({ level }: { level: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-label={`Etapa: ${STAGES[level]}`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn('h-1.5 w-5 rounded-full', level > n || level === 4 ? 'bg-success' : level === n ? 'bg-brand' : 'bg-surface-3')}
        />
      ))}
    </span>
  );
}

function PathItem({ r, today }: { r: TrailRow; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const level = r.level ?? 0;
  const status =
    level === 4
      ? r.nextReview
        ? `Dominado · volta nas listas a partir de ${formatDate(r.nextReview)}`
        : 'Dominado'
      : level >= 1
        ? `${STAGES[level]}${r.list && r.list.round > 1 ? ` · ${r.list.round}ª lista` : ''}`
        : r.scheduled
          ? `Teoria · ${r.scheduled === today ? 'hoje' : formatDate(r.scheduled)}`
          : 'Na fila';
  async function studyToday() {
    setBusy(true);
    const res = await addToDay(r.key, today).catch(() => ({ error: 'Sem conexão.' }));
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast('Assunto colocado na sua agenda de hoje.');
    router.refresh();
  }
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute top-3 -left-[27px] grid size-3.5 place-items-center rounded-full border-2 border-bg',
          level === 4 ? 'bg-success' : level >= 1 ? 'bg-brand' : r.scheduled ? 'bg-zinc-400' : 'bg-surface-3',
        )}
      />
      <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2/60">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <span className="truncate">{r.short}</span>
            {r.priority >= 3 && <Flame className="size-3 shrink-0 text-orange-500" aria-label="mais cobrado" />}
            {level === 4 && <Trophy className="size-3.5 shrink-0 text-success" aria-label="dominado" />}
          </p>
          <p className={cn('text-[11px]', r.hard ? 'text-danger' : 'text-muted')}>
            {status}
            {r.hard && ' · reforço semanal'}
          </p>
        </div>
        <Steps level={level} />
        {r.list ? (
          <Link href={`/listas/${r.list.id}`} aria-label="Fazer a lista" className={buttonClass('ghost', 'icon', 'size-8 text-brand')}>
            <Play className="size-4" />
          </Link>
        ) : level === 0 && !r.scheduled ? (
          <button type="button" onClick={studyToday} disabled={busy} aria-label="Estudar hoje" title="Estudar hoje" className={buttonClass('ghost', 'icon', 'size-8 text-muted')}>
            {busy ? <Spinner className="size-3.5" /> : <Plus className="size-4" />}
          </button>
        ) : level === 4 ? (
          <span className="grid size-8 place-items-center text-success">
            <Check className="size-4" />
          </span>
        ) : (
          <span className="size-8" />
        )}
      </div>
    </li>
  );
}
