import { CheckCircle2, Clock, Flame, Target } from 'lucide-react';
import { ComboChart } from '@/components/charts/combo-chart';
import { Card } from '@/components/ui';
import { accuracyBySubject, fmtMinutes, streak, todayBR } from '@/lib/mentoria';
import type { Mentoria, MentoriaSession, MentoriaTask } from '@/lib/types';
import { addDays, cn, formatDate, weekStart } from '@/lib/utils';

/** Painel de desempenho do mentorado (o mesmo para o aluno e para o mentor). */
export function MentoriaPerformance({
  mentoria,
  sessions,
  tasks,
  simulados,
  simuladoHref,
}: {
  mentoria: Mentoria;
  sessions: MentoriaSession[];
  tasks: MentoriaTask[];
  simulados: { title: string; tri_score: number; accuracy: number; use_tri: boolean; simulado_id: string }[];
  simuladoHref?: (id: string) => string;
}) {
  const today = todayBR();
  const thisWeek = weekStart(new Date(`${today}T12:00:00`));
  const weekMin = sessions.filter((s) => s.studied_on >= thisWeek).reduce((a, s) => a + s.minutes, 0);
  const goalMin = mentoria.weekly_hours_target * 60;
  const last30 = sessions.filter((s) => s.studied_on >= addDays(today, -30));
  const q30 = last30.reduce((a, s) => a + s.questions, 0);
  const c30 = last30.reduce((a, s) => a + s.correct, 0);
  const doneTasks = tasks.filter((t) => t.done).length;
  const days = streak(sessions);

  // Horas por semana (8 semanas)
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)));
  const perWeek = weeks.map((w) => sessions.filter((s) => s.studied_on >= w && s.studied_on < addDays(w, 7)).reduce((a, s) => a + s.minutes, 0));
  const maxW = Math.max(goalMin, ...perWeek, 60);

  // Tempo por matéria (30 dias)
  const bySubject = new Map<string, number>();
  last30.forEach((s) => s.subject && s.minutes && bySubject.set(s.subject, (bySubject.get(s.subject) ?? 0) + s.minutes));
  const time = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const maxT = Math.max(1, ...time.map(([, m]) => m));
  const acc = accuracyBySubject(last30);

  const tri = simulados.filter((s) => s.use_tri !== false);
  const lastTri = tri.at(-1)?.tri_score;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Clock className="size-4" />} label="Esta semana" value={fmtMinutes(weekMin)} hint={`meta ${mentoria.weekly_hours_target} h`} pct={goalMin ? weekMin / goalMin : 0} />
        <Kpi icon={<Flame className="size-4" />} label="Sequência" value={`${days} dia${days === 1 ? '' : 's'}`} hint="estudando seguidos" />
        <Kpi icon={<Target className="size-4" />} label="Acerto (30 dias)" value={q30 ? `${Math.round((c30 / q30) * 100)}%` : '—'} hint={`${q30} questões`} />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Tarefas da semana" value={tasks.length ? `${doneTasks}/${tasks.length}` : '—'} pct={tasks.length ? doneTasks / tasks.length : 0} />
      </div>

      <Card className="p-4 sm:p-5">
        <p className="mb-3 text-sm font-bold text-ink">Horas por semana</p>
        <div className="relative flex h-40 items-end gap-2">
          {goalMin > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-success/60" style={{ bottom: `${(goalMin / maxW) * 100}%` }} />}
          {perWeek.map((m, i) => (
            <div key={weeks[i]} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-bold text-ink tabular-nums">{m ? Math.round(m / 6) / 10 : ''}</span>
              <div className={cn('w-full rounded-t-md', m >= goalMin && goalMin ? 'bg-success' : 'bg-brand')} style={{ height: `${Math.max(2, (m / maxW) * 100)}%` }} />
              <span className="text-[9px] text-muted">{formatDate(weeks[i]).replace(' de', '')}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-bold text-ink">Acerto por matéria</p>
          {acc.length ? (
            <ul className="space-y-2.5">
              {acc.map((a) => (
                <li key={a.subject}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-ink">{a.subject}</span>
                    <span className="text-muted tabular-nums">
                      {a.correct}/{a.questions} · <strong className="text-ink">{a.pct}%</strong>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn('h-full rounded-full', a.pct >= 70 ? 'bg-success' : a.pct >= 50 ? 'bg-warning' : 'bg-danger')} style={{ width: `${a.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Registre as questões feitas para ver o acerto por matéria.</p>
          )}
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="mb-3 text-sm font-bold text-ink">Tempo por matéria (30 dias)</p>
          {time.length ? (
            <ul className="space-y-2.5">
              {time.map(([s, m]) => (
                <li key={s}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-ink">{s}</span>
                    <span className="text-muted tabular-nums">{fmtMinutes(m)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(m / maxT) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Use o cronômetro para registrar o tempo de estudo.</p>
          )}
        </Card>
      </div>

      {tri.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-ink">Simulados (nota TRI)</p>
            {mentoria.target_score > 0 && lastTri !== undefined && (
              <p className="text-xs text-muted">
                Última: <strong className="text-ink">{Number(lastTri).toFixed(0)}</strong> · meta {mentoria.target_score}
                {Number(lastTri) < mentoria.target_score && ` · faltam ${Math.round(mentoria.target_score - Number(lastTri))}`}
              </p>
            )}
          </div>
          <ComboChart
            points={tri.map((s) => ({ label: s.title, bar: Number(s.tri_score), barLabel: Number(s.tri_score).toFixed(0), href: simuladoHref?.(s.simulado_id) }))}
            min={200}
            ticks={[200, 400, 600, 800, 1000]}
            barName="Nota TRI"
            lineName="Evolução"
          />
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, pct }: { icon: React.ReactNode; label: string; value: string; hint?: string; pct?: number }) {
  return (
    <Card className="p-3.5 sm:p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className="text-brand">{icon}</span> {label}
      </p>
      <p className="mt-1.5 text-xl font-extrabold text-ink tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
      {pct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className={cn('h-full rounded-full', pct >= 1 ? 'bg-success' : 'bg-brand')} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
      )}
    </Card>
  );
}
