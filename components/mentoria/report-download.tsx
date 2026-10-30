'use client';

import { FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { weeklyReport } from '@/app/(app)/admin/mentoria/report-actions';
import { toast } from '@/components/toast';
import { buttonClass, Select } from '@/components/ui';
import { Spinner } from '@/components/ui-client';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const br = (s: string) => s.split('-').reverse().slice(0, 2).join('/');

/** Escolhe a semana e baixa o relatório em PDF (sem tela de relatório no app). */
export function ReportDownload({ target }: { target: string }) {
  const weeks = useMemo(() => {
    const now = new Date();
    const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return Array.from({ length: 12 }, (_, i) => {
      const a = new Date(monday);
      a.setUTCDate(a.getUTCDate() - 7 * i);
      const b = new Date(a);
      b.setUTCDate(b.getUTCDate() + 6);
      return { value: iso(a), label: `${i === 0 ? 'Esta semana' : i === 1 ? 'Semana passada' : 'Semana'} · ${br(iso(a))} a ${br(iso(b))}` };
    });
  }, []);
  const [week, setWeek] = useState(weeks[0].value);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const r = await weeklyReport(target, week);
      if (!r.report) throw new Error(r.error);
      const { reportPdf } = await import('@/lib/report-pdf');
      const bytes = await reportPdf(r.report);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${r.report.title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${week}.pdf`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={week} onChange={(e) => setWeek(e.target.value)} className="h-9 w-auto min-w-0 text-xs" aria-label="Semana do relatório">
        {weeks.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label}
          </option>
        ))}
      </Select>
      <button type="button" onClick={go} disabled={busy} className={buttonClass('primary', 'sm', 'h-9 whitespace-nowrap')}>
        {busy ? <Spinner /> : <FileDown className="size-4" />} Baixar relatório (PDF)
      </button>
    </div>
  );
}
