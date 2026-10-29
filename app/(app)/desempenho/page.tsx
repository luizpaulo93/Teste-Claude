import { Award, BarChart3, Target, Trophy, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ComboChart } from '@/components/charts/combo-chart';
import { Card, EmptyState } from '@/components/ui';
import { getCatalogData, sql } from '@/lib/db';
import { requireViewer } from '@/lib/session';
import { ENEM_AREAS, type EnemArea, type SimuladoStats } from '@/lib/types';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Desempenho' };

interface Row {
  simulado_id: string;
  user_id: string;
  tri_score: number;
  correct: number;
  coherence: number;
  accuracy: number;
  name: string;
  class_id: string | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
/** "Ana Beatriz Costa" → "Ana C." para o ranking que os alunos veem */
const short = (name: string) => {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || 'Aluno';
};

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ s?: string; t?: string }> }) {
  const viewer = await requireViewer();
  if (!viewer.isMember) redirect('/');
  const { s = 'all', t } = await searchParams;
  const admin = viewer.isAdmin;

  const [sims, rows, catalog] = await Promise.all([
    sql.query<{ id: string; title: string; area: EnemArea; question_count: number; stats: SimuladoStats }>(
      `select id, title, area, question_count, stats from simulados where results_released and is_published order by created_at`,
    ),
    sql.query<Row>(
      `select r.simulado_id, r.user_id, r.tri_score, r.correct, r.coherence, r.accuracy,
              coalesce(nullif(st.name, ''), nullif(u.full_name, ''), split_part(u.email, '@', 1)) as name, st.class_id
         from simulado_results r
         join simulados sm on sm.id = r.simulado_id and sm.results_released
         left join users u on u.id = r.user_id
         left join students st on st.email = u.email`,
    ),
    getCatalogData(),
  ]);

  if (!sims.length) {
    return (
      <>
        <Header />
        <EmptyState icon={<BarChart3 className="size-6" />} title="Ainda sem resultados" description="O painel aparece quando as notas de algum simulado forem liberadas." />
      </>
    );
  }

  // Aluno vê a própria turma; admin escolhe a turma (ou todas)
  const myClass = viewer.student?.class_id ?? null;
  const turma = admin ? (t && catalog.classes.some((c) => c.id === t) ? t : null) : myClass;
  const sim = sims.find((x) => x.id === s) ?? null;
  const className = (id: string | null) => catalog.classes.find((c) => c.id === id)?.name ?? 'Sem turma';
  const inScope = (r: Row) => (!turma || r.class_id === turma) && (!sim || r.simulado_id === sim.id);
  const scoped = rows.filter(inScope);

  // Números gerais do recorte
  const kpi = {
    entregas: scoped.length,
    tri: r1(avg(scoped.map((r) => r.tri_score))),
    coh: Math.round(avg(scoped.map((r) => r.coherence))),
    acc: Math.round(avg(scoped.map((r) => r.accuracy))),
  };

  // Evolução por simulado: média da turma (ou geral) e, para o aluno, a própria nota
  const mine = new Map(rows.filter((r) => r.user_id === viewer.userId).map((r) => [r.simulado_id, r]));
  const chart = sims.map((x) => {
    const group = rows.filter((r) => r.simulado_id === x.id && (!turma || r.class_id === turma));
    const meanTri = group.length ? avg(group.map((r) => r.tri_score)) : null;
    if (admin) {
      const meanCoh = group.length ? avg(group.map((r) => r.coherence)) : null;
      return { label: x.title, bar: meanTri, line: meanCoh == null ? null : 300 + (meanCoh / 100) * 650 };
    }
    const me = mine.get(x.id);
    return { label: x.title, bar: me?.tri_score ?? null, line: meanTri };
  });

  // Ranking de alunos: melhor média de TRI no recorte
  const byUser = new Map<string, Row[]>();
  scoped.forEach((r) => byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]));
  const ranking = [...byUser.entries()]
    .map(([user_id, list]) => ({
      user_id,
      name: list[0].name,
      class_id: list[0].class_id,
      tri: r1(avg(list.map((r) => r.tri_score))),
      correct: r1(avg(list.map((r) => r.correct))),
      coh: Math.round(avg(list.map((r) => r.coherence))),
      n: list.length,
    }))
    .sort((a, b) => b.tri - a.tri);
  const myPos = ranking.findIndex((r) => r.user_id === viewer.userId);

  // Ranking de turmas (só admin)
  const byClass = new Map<string, Row[]>();
  rows.filter((r) => !sim || r.simulado_id === sim.id).forEach((r) => {
    const k = r.class_id ?? '';
    byClass.set(k, [...(byClass.get(k) ?? []), r]);
  });
  const classes = [...byClass.entries()]
    .map(([id, list]) => ({ id, name: className(id || null), tri: r1(avg(list.map((r) => r.tri_score))), coh: Math.round(avg(list.map((r) => r.coherence))), alunos: new Set(list.map((r) => r.user_id)).size }))
    .sort((a, b) => b.tri - a.tri);

  // Questões mais difíceis do simulado escolhido
  const hardest = sim?.stats?.items ? [...sim.stats.items].sort((a, b) => a.hitPct - b.hitPct).slice(0, 5) : [];

  const q = (patch: { s?: string; t?: string | null }) => {
    const p = new URLSearchParams();
    const ns = patch.s ?? s;
    const nt = patch.t === undefined ? turma : patch.t;
    if (ns && ns !== 'all') p.set('s', ns);
    if (admin && nt) p.set('t', nt);
    const str = p.toString();
    return `/desempenho${str ? `?${str}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Header subtitle={admin ? 'Turmas e alunos por simulado' : turma ? `Sua turma: ${className(turma)}` : 'Seus simulados'} />

      {/* Filtros */}
      <div className="space-y-2">
        <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip href={q({ s: 'all' })} active={!sim}>
            Todos os simulados
          </Chip>
          {sims.map((x) => (
            <Chip key={x.id} href={q({ s: x.id })} active={sim?.id === x.id}>
              {x.title}
            </Chip>
          ))}
        </div>
        {admin && (
          <div className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Chip href={q({ t: null })} active={!turma} small>
              Todas as turmas
            </Chip>
            {catalog.classes.map((c) => (
              <Chip key={c.id} href={q({ t: c.id })} active={turma === c.id} small>
                {c.name}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Números */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {admin || !mine.size ? (
          <>
            <Kpi icon={<Users className="size-4" />} label="Entregas" value={kpi.entregas} />
            <Kpi icon={<Trophy className="size-4" />} label="Média TRI" value={kpi.tri || '—'} />
            <Kpi icon={<Target className="size-4" />} label="Coerência média" value={`${kpi.coh}%`} />
            <Kpi icon={<Award className="size-4" />} label="Acertos" value={`${kpi.acc}%`} />
          </>
        ) : (
          <>
            <Kpi icon={<Trophy className="size-4" />} label="Sua média TRI" value={r1(avg([...mine.values()].filter((r) => !sim || r.simulado_id === sim.id).map((r) => r.tri_score))) || '—'} />
            <Kpi icon={<Users className="size-4" />} label="Média da turma" value={kpi.tri || '—'} />
            <Kpi icon={<Target className="size-4" />} label="Sua coerência" value={`${Math.round(avg([...mine.values()].filter((r) => !sim || r.simulado_id === sim.id).map((r) => r.coherence)))}%`} />
            <Kpi icon={<Award className="size-4" />} label="Sua posição" value={myPos >= 0 ? `${myPos + 1}º de ${ranking.length}` : '—'} />
          </>
        )}
      </div>

      {/* Evolução */}
      <Card className="p-4 sm:p-5">
        <p className="mb-3 text-sm font-bold text-ink">Evolução por simulado</p>
        <ComboChart points={chart} barName={admin ? 'Média TRI' : 'Sua nota TRI'} lineName={admin ? 'Coerência média' : 'Média da turma'} />
      </Card>

      <div className={cn('grid gap-5', admin && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
        {/* Ranking de alunos */}
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line p-4">
            <p className="text-sm font-bold text-ink">{admin ? 'Melhores alunos' : 'Ranking da turma'}</p>
            <span className="text-xs text-muted">{sim ? sim.title : 'média de todos'}</span>
          </div>
          <ol className="divide-y divide-line">
            {(admin ? ranking.slice(0, 50) : ranking.slice(0, 10)).map((r, i) => (
              <RankRow key={r.user_id} pos={i + 1} me={r.user_id === viewer.userId} name={admin ? r.name : r.user_id === viewer.userId ? 'Você' : short(r.name)} sub={admin ? className(r.class_id) : undefined} tri={r.tri} extra={`${r.correct} acertos · coer. ${r.coh}%`} />
            ))}
            {!admin && myPos >= 10 && (
              <RankRow pos={myPos + 1} me name="Você" tri={ranking[myPos].tri} extra={`${ranking[myPos].correct} acertos · coer. ${ranking[myPos].coh}%`} />
            )}
            {!ranking.length && <li className="p-4 text-sm text-muted">Nenhuma entrega neste recorte.</li>}
          </ol>
        </Card>

        {admin && (
          <div className="min-w-0 space-y-5">
            <Card className="overflow-hidden">
              <div className="border-b border-line p-4">
                <p className="text-sm font-bold text-ink">Ranking de turmas</p>
              </div>
              <ol className="divide-y divide-line">
                {classes.map((c, i) => (
                  <li key={c.id || 'none'}>
                    <Link href={q({ t: c.id || null })} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                      <Medal pos={i + 1} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
                        <span className="text-[11px] text-muted">
                          {c.alunos} aluno{c.alunos === 1 ? '' : 's'} · coer. {c.coh}%
                        </span>
                      </span>
                      <span className="text-sm font-extrabold text-ink tabular-nums">{c.tri}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
            {sim && hardest.length > 0 && (
              <Card className="p-4">
                <p className="mb-3 text-sm font-bold text-ink">Questões com menos acertos</p>
                <ul className="space-y-2">
                  {hardest.map((it) => (
                    <li key={it.q} className="flex items-center gap-3 text-sm">
                      <span className="w-10 font-bold text-ink-2 tabular-nums">Q{it.q}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-danger" style={{ width: `${Math.max(3, it.hitPct)}%` }} />
                      </span>
                      <span className="w-10 text-right text-xs text-muted tabular-nums">{it.hitPct}%</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted">{ENEM_AREAS[sim.area]} · {sim.question_count} questões</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Desempenho</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

function Chip({ href, active, small, children }: { href: string; active: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        'shrink-0 rounded-full border font-semibold whitespace-nowrap transition',
        small ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        active ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
      )}
    >
      {children}
    </Link>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className="text-brand">{icon}</span> {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
    </Card>
  );
}

function Medal({ pos }: { pos: number }) {
  const color = pos === 1 ? 'bg-amber-400 text-black' : pos === 2 ? 'bg-slate-300 text-black' : pos === 3 ? 'bg-orange-400 text-black' : 'bg-surface-3 text-ink-2';
  return <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold tabular-nums', color)}>{pos}</span>;
}

function RankRow({ pos, name, sub, tri, extra, me }: { pos: number; name: string; sub?: string; tri: number; extra: string; me?: boolean }) {
  return (
    <li className={cn('flex items-center gap-3 px-4 py-2.5', me && 'bg-brand-soft')}>
      <Medal pos={pos} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
        <span className="block truncate text-[11px] text-muted">{sub ? `${sub} · ${extra}` : extra}</span>
      </span>
      <span className="text-sm font-extrabold text-ink tabular-nums">{tri}</span>
    </li>
  );
}
