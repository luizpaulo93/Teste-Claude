'use client';

import { BookOpenCheck, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { buttonClass, Card } from '@/components/ui';
import { useStampedPdf, type PdfOwner } from '@/lib/pdf-stamp';

/** Resolução liberada pelo professor (com a marca do aluno em cada página). */
export function ResolutionCard({ url, owner, listHref }: { url: string; owner?: PdfOwner | null; listHref?: string }) {
  const stamped = useStampedPdf(url, owner);
  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 border-success/40 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/12 text-success">
        <BookOpenCheck className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">Resolução liberada</span>
        <span className="block text-xs text-muted">O professor liberou a resolução deste simulado.</span>
      </span>
      <span className="flex flex-wrap gap-2">
        {listHref && (
          <Link href={listHref} className={buttonClass('secondary', 'sm')}>
            <ListChecks className="size-4" /> Ver questões
          </Link>
        )}
        <a href={stamped || url} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'sm')}>
          <BookOpenCheck className="size-4" /> Abrir resolução
        </a>
      </span>
    </Card>
  );
}
