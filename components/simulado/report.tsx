import { ChevronRight, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui';
import type { ReportRow } from '@/lib/simulado-report';
import type { Tier } from '@/lib/types';
import { cn, formatClock } from '@/lib/utils';

/** Abas no estilo do app (ex.: Notas TRI | Sem TRI). */
export function SegTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="inline-grid rounded-xl border border-line bg-surface p-1 text-sm font-semibold" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          className={cn('rounded-lg px-4 py-1.5 text-center whitespace-nowrap transition', active === t.key ? 'bg-brand text-white shadow' : 'text-ink-2 hover:text-ink')}
        >
          {t.label} {t.count !== undefined && <span className="text-xs opacity-70">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Barras de % de acerto por questão (verde fácil, amarelo média, vermelho difícil). */
export function QuestionChart({ items }: { items: { q: number; hitPct: number; tier: Tier }[] }) {
  if (!items.length) return null;
  return (
    <Card className="p-4 sm:p-5">
      <p className="mb-3 text-sm font-bold text-ink">Acerto por questão</p>
      <div className="scrollbar-thin overflow-x-auto pb-1">
        <div className="flex h-36 items-stretch gap-[3px]" style={{ minWidth: items.length * 14 }}>
          {items.map((it) => (
            <div key={it.q} className="flex min-w-[11px] flex-1 flex-col items-center justify-end gap-1" title={`Questão ${it.q}: ${it.hitPct}% de acerto`}>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn('w-full rounded-t-sm', it.tier === 'easy' ? 'bg-success' : it.tier === 'medium' ? 'bg-warning' : 'bg-danger')}
                  style={{ height: `${Math.max(3, it.hitPct)}%` }}
                />
              </div>
              <span className="h-3 text-[9px] leading-3 text-muted tabular-nums">{it.q === 1 || it.q % 5 === 0 ? it.q : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-success" /> fácil
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-warning" /> média
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-danger" /> difícil
        </span>
      </div>
    </Card>
  );
}

const medal = (i: number) => (i === 0 ? 'bg-amber-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'bg-surface-3 text-ink-2');

/** Cards das turmas em ranking. */
export function ClassCards({
  items,
  hrefFor,
  useTri,
}: {
  items: { id: string; name: string; entregas: number; meanTri: number | null; meanCorrect: number | null }[];
  hrefFor: (id: string) => string;
  useTri: boolean;
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Users className="size-4 text-brand" /> Turmas
      </h2>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c, i) => (
          <Link key={c.id} href={hrefFor(c.id)} className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition hover:border-brand/50 hover:bg-surface-2">
            <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold', medal(i))}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{c.name}</span>
              <span className="block text-[11px] text-muted">
                {c.entregas} aluno{c.entregas === 1 ? '' : 's'} · {c.meanCorrect ?? 0} acertos em média
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-lg font-extrabold text-ink tabular-nums">{useTri && c.meanTri != null ? c.meanTri.toFixed(0) : (c.meanCorrect ?? '—')}</span>
              <span className="block text-[10px] text-muted uppercase">{useTri && c.meanTri != null ? 'média TRI' : 'acertos'}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Alunos em ranking (cards, sem tabela cortada no celular). */
export function StudentRanking({
  rows,
  useTri,
  total,
  title = 'Alunos',
  extra,
  showClass,
}: {
  rows: (ReportRow & { className?: string })[];
  useTri: boolean;
  total: number;
  title?: string;
  extra?: (r: ReportRow) => ReactNode;
  showClass?: boolean;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Trophy className="size-4 text-warning" /> {title}
      </h2>
      {rows.length ? (
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((r, i) => {
            const done = r.status === 'completed';
            return (
              <li key={r.user_id} className="flex items-center gap-2 border-b border-line pr-2 last:border-b-0">
                <Link href={`/desempenho/aluno/${r.user_id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 transition hover:bg-surface-2 sm:pl-4">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold', done ? medal(i) : 'bg-surface-3 text-muted')}>{done ? i + 1 : '–'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {done ? `${r.correct}/${total} acertos · ${formatClock(r.duration_seconds)}` : 'Fazendo a prova'}
                      {showClass && r.className ? ` · ${r.className}` : ''}
                      {useTri && r.coherence != null ? ` · coerência ${r.coherence}%` : ''}
                    </span>
                  </span>
                  {done ? (
                    <span className="shrink-0 text-right">
                      <span className="block text-base font-extrabold text-ink tabular-nums">{useTri && r.tri != null ? r.tri.toFixed(1) : `${r.correct}`}</span>
                      <span className="block text-[10px] text-muted uppercase">{useTri && r.tri != null ? 'TRI' : 'acertos'}</span>
                    </span>
                  ) : (
                    <Badge tone="warning">Fazendo</Badge>
                  )}
                </Link>
                {extra?.(r)}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Ninguém fez este simulado ainda.</p>
      )}
    </section>
  );
}
