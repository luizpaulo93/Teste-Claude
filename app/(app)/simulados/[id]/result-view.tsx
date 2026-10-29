'use client';

import { useStampedPdf, type PdfOwner } from '@/lib/pdf-stamp';
import { Brain, CheckCircle2, CircleSlash, FileText, Trophy, Users, XCircle } from 'lucide-react';
import { Badge, Card, Stat } from '@/components/ui';
import { ENEM_AREAS, type Simulado, type SimuladoResult, type SimuladoStats, type Tier } from '@/lib/types';
import { cn } from '@/lib/utils';

const TIER_LABEL: Record<Tier, string> = { easy: 'Fáceis', medium: 'Médias', hard: 'Difíceis' };

export function ResultView({
  simulado,
  result,
  stats,
  pdfUrl: rawPdf,
  pdfOwner,
}: {
  simulado: Simulado;
  result: SimuladoResult;
  stats?: SimuladoStats;
  pdfUrl: string;
  pdfOwner?: PdfOwner | null;
}) {
  const stamped = useStampedPdf(rawPdf, pdfOwner);
  const pdfUrl = rawPdf ? stamped : '';
  const score = Number(result.tri_score);
  const min = Number(result.tri_min);
  const max = Number(result.tri_max);
  const mean = Number(result.tri_mean);
  const pos = max > min ? ((score - min) / (max - min)) * 100 : 50;
  const hitPct = new Map((stats?.items ?? []).map((i) => [i.q, i.hitPct]));
  const tri = simulado.use_tri !== false;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#0b1a3a] via-brand-strong to-accent p-6 text-white sm:p-8">
          <div className="absolute inset-0 bg-[image:radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.22),transparent_45%)]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge className="bg-white/15 text-white">{ENEM_AREAS[simulado.area]}</Badge>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{simulado.title}</h1>
              <p className="mt-1 text-sm text-white/70">Resultado oficial liberado</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70 sm:justify-end">
                <Trophy className="size-3.5" /> {tri ? 'Nota TRI estimada' : 'Acertos'}
              </p>
              <p className="text-5xl font-black tracking-tight tabular-nums sm:text-6xl">
                {tri ? score.toFixed(1) : `${result.correct}/${simulado.question_count}`}
              </p>
            </div>
          </div>
          {tri && <div className="relative mt-6">
            <div className="relative h-2 rounded-full bg-white/20">
              <div className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-lg" style={{ left: `${Math.max(0, Math.min(100, pos))}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/70 tabular-nums">
              <span>mín {min.toFixed(0)}</span>
              <span>média {mean.toFixed(0)}</span>
              <span>máx {max.toFixed(0)}</span>
            </div>
            <p className="mt-2 text-xs text-white/60">Faixa possível para {result.correct} acertos. Sua posição depende da coerência pedagógica das respostas.</p>
          </div>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Acertos" value={result.correct} hint={`${result.accuracy}% da prova`} icon={<CheckCircle2 className="size-4" />} />
        <Stat label="Erros" value={result.wrong} icon={<XCircle className="size-4" />} />
        <Stat label="Em branco" value={result.blank} icon={<CircleSlash className="size-4" />} />
        {tri ? (
          <Stat label="Coerência" value={`${result.coherence}%`} hint="Padrão de acertos" icon={<Brain className="size-4" />} />
        ) : (
          <Stat label="Aproveitamento" value={`${result.accuracy}%`} icon={<Brain className="size-4" />} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tri && <Card className="p-5">
          <p className="mb-4 text-sm font-bold text-ink">Desempenho por dificuldade</p>
          <div className="space-y-4">
            {(['easy', 'medium', 'hard'] as Tier[]).map((t) => {
              const v = result.tiers?.[t] ?? { correct: 0, total: 0 };
              const p = v.total ? Math.round((v.correct / v.total) * 100) : 0;
              return (
                <div key={t}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-semibold text-ink-2">{TIER_LABEL[t]}</span>
                    <span className="text-muted tabular-nums">
                      {v.correct}/{v.total} · {p}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={cn('h-full rounded-full', t === 'easy' ? 'bg-success' : t === 'medium' ? 'bg-warning' : 'bg-danger')}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>}
        {stats && stats.completed > 0 && (
          <Card className="p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <Users className="size-4 text-brand" /> Comparativo da turma
            </p>
            <dl className="space-y-3 text-sm">
              <Row label="Participantes" value={stats.completed} />
              {tri && <Row label="Média TRI da turma" value={stats.meanTri.toFixed(1)} />}
              <Row label="Média de acertos" value={stats.meanCorrect} />
              {tri ? (
                <Row label="Você vs. média" value={`${score >= stats.meanTri ? '+' : ''}${(score - stats.meanTri).toFixed(1)}`} highlight={score >= stats.meanTri} />
              ) : (
                <Row label="Você vs. média" value={`${result.correct >= stats.meanCorrect ? '+' : ''}${(result.correct - stats.meanCorrect).toFixed(1)} acertos`} highlight={result.correct >= stats.meanCorrect} />
              )}
            </dl>
          </Card>
        )}
        {pdfUrl && (
          <Card className="flex flex-col justify-between p-5">
            <p className="text-sm font-bold text-ink">Caderno de questões</p>
            <p className="mt-1 text-sm text-muted">Revise as questões que você errou com o gabarito ao lado.</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <FileText className="size-4" /> Abrir prova
            </a>
          </Card>
        )}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink">Gabarito comentado</p>
          <div className="flex gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success" /> acerto</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-danger" /> erro</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-surface-3" /> branco</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-9">
          {result.breakdown.map((b) => (
            <div
              key={b.q}
              className={cn(
                'rounded-xl border p-2 text-center',
                b.marked === '-' ? 'border-line bg-surface-2' : b.ok ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10',
              )}
            >
              <p className="text-[10px] font-bold text-muted">Q{b.q}</p>
              <p className="mt-0.5 text-sm font-extrabold">
                <span className={b.ok ? 'text-success' : b.marked === '-' ? 'text-muted' : 'text-danger'}>{b.marked === '-' ? '–' : b.marked}</span>
                {!b.ok && <span className="text-ink-2"> → {b.official}</span>}
              </p>
              {hitPct.has(b.q) && <p className="mt-0.5 text-[10px] text-muted">{hitPct.get(b.q)}% turma</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('font-bold tabular-nums', highlight === undefined ? 'text-ink' : highlight ? 'text-success' : 'text-danger')}>{value}</dd>
    </div>
  );
}
