'use client';

import { CheckCircle2, ClipboardCheck, Clock, Hourglass, Lock, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from '@/components/toast';
import { buttonClass, Card } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import { createClient } from '@/lib/supabase/client';
import { ENEM_AREAS, type Simulado, type SimuladoSubmission } from '@/lib/types';
import { formatClock } from '@/lib/utils';

export function StartCard({ simulado, submission, userId }: { simulado: Simulado; submission: SimuladoSubmission | null; userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const { error } = await createClient()
      .from('simulado_submissions')
      .insert({ simulado_id: simulado.id, user_id: userId, answers: '-'.repeat(simulado.question_count) });
    if (error && !error.message.includes('duplicate')) {
      setLoading(false);
      return toast.error('Não foi possível iniciar o simulado.');
    }
    router.refresh();
  }

  const done = submission?.status === 'completed';
  return (
    <Card className="mx-auto max-w-2xl overflow-hidden">
      <div className="relative bg-gradient-to-br from-brand-strong via-brand to-accent p-6 text-white sm:p-8">
        <div className="absolute inset-0 bg-[image:radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="relative">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{ENEM_AREAS[simulado.area]}</span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{simulado.title}</h1>
        </div>
      </div>
      <div className="space-y-6 p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-3">
          <Info icon={<ClipboardCheck className="size-4" />} label="Questões" value={String(simulado.question_count)} />
          <Info icon={<Clock className="size-4" />} label="Tempo" value={simulado.time_limit_minutes ? `${simulado.time_limit_minutes} min` : 'Livre'} />
        </div>

        {done ? (
          <div className="rounded-2xl border border-success/30 bg-success/10 p-5 text-center">
            <CheckCircle2 className="mx-auto size-8 text-success" />
            <p className="mt-2 font-bold text-ink">Prova entregue!</p>
            <p className="mt-1 text-sm text-muted">
              Tempo de prova: {formatClock(submission!.duration_seconds)}. {simulado.results_released ? 'Seu resultado está sendo processado.' : 'Você verá sua nota TRI assim que o professor liberar os resultados.'}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
              <Hourglass className="size-3.5" /> Aguardando liberação
            </p>
          </div>
        ) : simulado.results_released ? (
          <div className="rounded-2xl border border-line bg-surface-2 p-5 text-center">
            <Lock className="mx-auto size-7 text-muted" />
            <p className="mt-2 font-bold text-ink">Simulado encerrado</p>
            <p className="mt-1 text-sm text-muted">Os resultados já foram liberados e não é mais possível enviar respostas.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-2 text-sm text-ink-2">
              <li>• Suas respostas são salvas automaticamente a cada marcação.</li>
              <li>• {simulado.time_limit_minutes ? 'Ao fim do tempo a prova é entregue automaticamente.' : 'Não há limite de tempo, mas o cronômetro registra sua duração.'}</li>
              <li>• Depois de entregar, não é possível alterar as respostas.</li>
            </ul>
            <button type="button" onClick={start} disabled={loading} className={buttonClass('primary', 'lg', 'w-full')}>
              {loading ? <Spinner /> : <Play className="size-4 fill-current" />} Iniciar simulado
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-extrabold text-ink">{value}</p>
    </div>
  );
}
