import { CheckCircle2, CircleAlert, TrendingUp, XCircle } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ReportQuestion {
  n: number;
  disciplina: string;
  assunto: string;
  especifico: string;
  answered: boolean;
  correct: boolean;
}

/**
 * Relatório da lista: % de acertos e erros, como foi em cada assunto
 * (bem treinado / atenção / precisa melhorar) e as questões erradas com atalho para cada uma.
 */
/** `base`: página das questões (no relatório do Desempenho os atalhos levam para a lista). */
export function ListReport({ qs, base = '' }: { qs: ReportQuestion[]; base?: string }) {
  const done = qs.filter((q) => q.answered);
  const right = done.filter((q) => q.correct).length;
  const wrong = done.length - right;
  const pct = (n: number) => (done.length ? Math.round((n / done.length) * 100) : 0);
  const by = new Map<string, { disciplina: string; assunto: string; ok: number; n: number }>();
  for (const q of done) {
    const k = `${q.disciplina}|${q.assunto}`;
    const r = by.get(k) ?? { disciplina: q.disciplina, assunto: q.assunto, ok: 0, n: 0 };
    r.n++;
    if (q.correct) r.ok++;
    by.set(k, r);
  }
  const topics = [...by.values()].map((t) => ({ ...t, p: Math.round((t.ok / t.n) * 100) })).sort((a, b) => a.p - b.p);
  const level = (p: number) => (p >= 70 ? 'bom' : p >= 50 ? 'atencao' : 'melhorar');
  const groups = [
    { key: 'melhorar', label: 'Precisa melhorar', icon: XCircle, tone: 'text-danger', bar: 'bg-danger' },
    { key: 'atencao', label: 'Atenção', icon: CircleAlert, tone: 'text-warning', bar: 'bg-warning' },
    { key: 'bom', label: 'Bem treinados', icon: CheckCircle2, tone: 'text-success', bar: 'bg-success' },
  ] as const;
  const errors = done.filter((q) => !q.correct);

  return (
    <section id="relatorio" className="mt-10 scroll-mt-20 space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <TrendingUp className="size-5 text-brand" /> Relatório
      </h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3">
          <p className="text-2xl font-extrabold text-success">{pct(right)}%</p>
          <p className="text-[11px] text-muted">
            {right} {right === 1 ? 'acerto' : 'acertos'}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-extrabold text-danger">{pct(wrong)}%</p>
          <p className="text-[11px] text-muted">
            {wrong} {wrong === 1 ? 'erro' : 'erros'}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-extrabold text-ink">{qs.length - done.length}</p>
          <p className="text-[11px] text-muted">sem resposta</p>
        </Card>
      </div>

      {groups.map((g) => {
        const list = topics.filter((t) => level(t.p) === g.key);
        if (!list.length) return null;
        return (
          <Card key={g.key} className="space-y-2.5 p-4">
            <p className={cn('flex items-center gap-1.5 text-sm font-bold', g.tone)}>
              <g.icon className="size-4" /> {g.label}
            </p>
            {list.map((t) => (
              <div key={`${t.disciplina}|${t.assunto}`} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 break-words text-ink-2">
                    <b className="text-ink">{t.disciplina}</b> · {t.assunto}
                  </span>
                  <span className="shrink-0 font-semibold text-ink tabular-nums">
                    {t.ok}/{t.n} · {t.p}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn('h-full rounded-full', g.bar)} style={{ width: `${Math.max(4, t.p)}%` }} />
                </div>
              </div>
            ))}
          </Card>
        );
      })}

      {errors.length > 0 && (
        <Card className="space-y-1.5 p-4">
          <p className="text-sm font-bold text-ink">Questões que você errou</p>
          {errors.map((q) => (
            <a key={q.n} href={`${base}#q${q.n}`} className="block text-xs break-words text-ink-2 hover:text-brand">
              <b className="text-danger">Questão {q.n}</b> · {q.disciplina} · {q.especifico || q.assunto}
            </a>
          ))}
        </Card>
      )}
    </section>
  );
}
