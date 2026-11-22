'use client';

import { ArrowDown, ArrowUp, Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from '@/components/toast';
import { Button, Input } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import type { MentorPanel, PanelStudent } from '@/lib/mentoria-panel';
import { cn, formatDate } from '@/lib/utils';

const STAGE_DOTS = ['bg-zinc-400', 'bg-sky-400', 'bg-amber-400', 'bg-orange-500', 'bg-emerald-500'];
const acc = (a: number | null) => (a === null ? '—' : `${a}%`);
const href = (id: string) => `/admin/mentoria/${encodeURIComponent(id)}`;

/** Painel do mentor: rankings, evolução, onde atacar e a tabela completa (com exportação em PDF). */
export function MentorPanelView({ data }: { data: MentorPanel }) {
  const [busy, setBusy] = useState(false);
  async function exportPdf() {
    setBusy(true);
    try {
      const { panelPdf } = await import('@/lib/panel-pdf');
      const bytes = await panelPdf(data);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      a.download = `painel-mentoria-${data.today}.pdf`;
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    }
    setBusy(false);
  }
  const r = data.rankings;
  const t = data.totals;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Período">
          {[7, 30].map((d) => (
            <Link
              key={d}
              href={`/admin/mentoria/painel?dias=${d}`}
              aria-current={data.days === d ? 'page' : undefined}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium', data.days === d ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2')}
            >
              {d} dias
            </Link>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={exportPdf} disabled={busy}>
          {busy ? <Spinner /> : <Download className="size-4" />} Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
        <Kpi label="Ativos" value={`${t.active}/${t.students}`} hint="responderam no período" />
        <Kpi label="Questões" value={String(t.answered)} hint={`${data.days} dias`} />
        <Kpi label="Acerto médio" value={acc(t.accuracy)} hint="todos os mentorados" />
        <Kpi label="Listas feitas" value={String(t.lists)} hint="da trilha" />
        <Kpi label="Dominados" value={`${t.mastered}`} hint={`de ${t.subjects} assuntos`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Rank title="Mais ativos" list={r.active} value={(s) => `${s.answered} questões`} sub={(s) => `${s.activeDays} dia${s.activeDays === 1 ? '' : 's'} · ${s.listsDone} lista${s.listsDone === 1 ? '' : 's'}`} />
        <Rank title="Mais acertam" tone="success" list={r.best} value={(s) => acc(s.accuracy)} sub={(s) => `${s.answered} questões`} />
        <Rank title="Mais erram" tone="danger" list={r.worst} value={(s) => `${s.answered - s.correct} erros`} sub={(s) => `${acc(s.accuracy)} de acerto`} />
        <Rank
          title="Sem usar a plataforma"
          tone="danger"
          list={r.inactive}
          empty="Todos estudaram no período."
          value={(s) => (s.idleDays === null ? 'nunca' : `${s.idleDays} dias`)}
          sub={(s) => (s.lastActive ? `última vez em ${formatDate(s.lastActive)}` : 'nunca respondeu questões')}
        />
        <Rank
          title="Maior melhora"
          tone="success"
          list={r.improving}
          empty="Sem dados para comparar ainda."
          value={(s) => `+${s.delta} p.p.`}
          sub={(s) => `${acc(s.accuracyBefore)} → ${acc(s.accuracy)}`}
        />
        <Rank
          title="Estão piorando"
          tone="danger"
          list={r.worsening}
          empty="Ninguém piorou no período."
          value={(s) => `${s.delta} p.p.`}
          sub={(s) => `${acc(s.accuracyBefore)} → ${acc(s.accuracy)}`}
        />
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Onde atacar</h2>
          <p className="text-xs text-muted">Assuntos com mais listas sem passar no período (todos os mentorados).</p>
        </header>
        {data.attack.length ? (
          <ul className="divide-y divide-line">
            {data.attack.map((a) => (
              <li key={a.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{a.title}</span>
                  <span className="font-mono text-[10.5px] tracking-[0.04em] text-muted uppercase">{a.discipline}</span>
                </span>
                <span className="num text-xs text-danger">{a.failed} sem passar</span>
                <span className="num w-16 text-right text-xs text-ink-2">{a.students} aluno{a.students === 1 ? '' : 's'}</span>
                <span className="num w-12 text-right text-xs text-muted">{acc(a.accuracy)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted">Nenhuma lista sem passar no período.</p>
        )}
      </section>

      <StudentsTable students={data.students} />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">{label}</p>
      <p className="num mt-1.5 text-2xl font-medium text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function Rank({
  title,
  list,
  value,
  sub,
  tone,
  empty = 'Ninguém neste período.',
}: {
  title: string;
  list: PanelStudent[];
  value: (s: PanelStudent) => string;
  sub: (s: PanelStudent) => string;
  tone?: 'success' | 'danger';
  empty?: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className={cn('size-1.5 rounded-full', tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : 'bg-brand')} />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </header>
      {list.length ? (
        <ol className="divide-y divide-line">
          {list.map((s, i) => (
            <li key={s.id}>
              <Link href={href(s.id)} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
                <span className="num w-4 text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                  <span className="block truncate text-[11px] text-muted">{sub(s)}</span>
                </span>
                <span className={cn('num shrink-0 text-xs font-medium', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink')}>{value(s)}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-muted">{empty}</p>
      )}
    </section>
  );
}

type Col = { key: string; label: string; get: (s: PanelStudent) => number | string | null; align?: 'right' };
const COLS: Col[] = [
  { key: 'name', label: 'Aluno', get: (s) => s.name.toLowerCase() },
  { key: 'last', label: 'Última atividade', get: (s) => (s.idleDays === null ? 99999 : s.idleDays) },
  { key: 'answered', label: 'Questões', get: (s) => s.answered, align: 'right' },
  { key: 'acc', label: 'Acerto', get: (s) => s.accuracy, align: 'right' },
  { key: 'delta', label: 'Evolução', get: (s) => s.delta, align: 'right' },
  { key: 'lists', label: 'Listas', get: (s) => s.listsDone, align: 'right' },
  { key: 'mastered', label: 'Trilha', get: (s) => (s.total ? s.stages[4] / s.total : -1), align: 'right' },
  { key: 'retained', label: 'Retidos', get: (s) => s.retainedNow, align: 'right' },
];

/** Tabela de todos os mentorados (toque no título da coluna para ordenar). */
function StudentsTable({ students }: { students: PanelStudent[] }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'last', dir: 1 });
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key)!;
    const term = q.trim().toLowerCase();
    return students
      .filter((s) => !term || `${s.name} ${s.email} ${s.group}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const x = col.get(a);
        const y = col.get(b);
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x < y ? -1 : 1) * sort.dir;
      });
  }, [students, sort, q]);
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">Todos os mentorados</h2>
          <p className="text-xs text-muted">Toque no título de uma coluna para ordenar; no nome, para abrir o aluno.</p>
        </div>
        <label className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno ou grupo" className="h-9 pl-8 text-xs" />
        </label>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line">
              {COLS.map((c) => (
                <th key={c.key} className={cn('px-3 py-2 font-mono text-[10.5px] font-medium tracking-[0.04em] text-muted uppercase', c.align === 'right' ? 'text-right' : 'text-left')}>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.key === 'name' || c.key === 'last' ? 1 : -1 }))}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    {c.label}
                    {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2/60">
                <td className="px-3 py-2.5">
                  <Link href={href(s.id)} className="block max-w-56 truncate font-medium text-ink hover:text-brand">
                    {s.name}
                  </Link>
                  <span className="block max-w-56 truncate text-[11px] text-muted">
                    {s.group || s.email}
                    {s.struggling.length ? ` · ${s.struggling.slice(0, 2).join(', ')}` : ''}
                  </span>
                </td>
                <td className={cn('num px-3 py-2.5 text-xs', (s.idleDays ?? 99) >= 7 ? 'text-danger' : 'text-ink-2')}>
                  {s.lastActive ? `${formatDate(s.lastActive)} · ${s.idleDays === 0 ? 'hoje' : `há ${s.idleDays}d`}` : 'nunca'}
                </td>
                <td className="num px-3 py-2.5 text-right text-xs text-ink">{s.answered}</td>
                <td className="num px-3 py-2.5 text-right text-xs text-ink">{acc(s.accuracy)}</td>
                <td className={cn('num px-3 py-2.5 text-right text-xs', s.delta === null ? 'text-muted' : s.delta > 0 ? 'text-success' : s.delta < 0 ? 'text-danger' : 'text-ink-2')}>
                  {s.delta === null ? '—' : `${s.delta > 0 ? '+' : ''}${s.delta}`}
                </td>
                <td className="num px-3 py-2.5 text-right text-xs text-ink-2">
                  {s.listsDone}
                  {s.listsFailed ? <span className="text-danger"> · {s.listsFailed} sem passar</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  <div className="ml-auto flex w-28 items-center gap-2">
                    <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      {s.stages.map((n, i) => (
                        <span key={i} className={cn('h-full', STAGE_DOTS[i])} style={{ width: `${(n / Math.max(1, s.total)) * 100}%` }} />
                      ))}
                    </span>
                    <span className="num text-[11px] text-muted">
                      {s.stages[4]}/{s.total}
                    </span>
                  </div>
                </td>
                <td className={cn('num px-3 py-2.5 text-right text-xs', s.retainedNow ? 'text-danger' : 'text-muted')}>{s.retainedNow}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-4 py-6 text-center text-sm text-muted">Nenhum mentorado.</p>}
      </div>
    </section>
  );
}
