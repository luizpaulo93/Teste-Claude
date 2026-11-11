'use client';

import { Upload } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from '@/components/toast';
import { useImportJob } from './import-job';

/** Importação de provas em andamento: aparece em qualquer tela do app (o envio continua enquanto navega). */
export function ImportProgress() {
  const job = useImportJob();
  const router = useRouter();
  const path = usePathname();
  const seen = useRef(job.finished);
  useEffect(() => {
    if (job.finished === seen.current) return;
    seen.current = job.finished;
    if (job.result) toast(job.result);
    router.refresh();
  }, [job.finished, job.result, router]);
  // na tela do importador a barra já aparece
  if (!job.running || path === '/admin/questoes') return null;
  const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <Link
      href="/admin/questoes"
      className="fixed right-3 bottom-20 z-[80] flex w-60 max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-2xl border border-line-strong bg-surface/95 p-2.5 shadow-2xl backdrop-blur lg:bottom-4"
      aria-label="Importação de questões em andamento"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
        <Upload className="size-4 animate-pulse" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-ink">{job.label}</span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </span>
        <span className="mt-0.5 block text-[10px] text-muted tabular-nums">
          {job.done}/{job.total}
        </span>
      </span>
    </Link>
  );
}
