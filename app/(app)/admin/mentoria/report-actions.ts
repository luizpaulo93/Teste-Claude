'use server';

import { requireAdminAction } from '@/lib/admin/guard';
import { emailKey, sql } from '@/lib/db';
import { shift } from '@/lib/mentoria';
import { buildReport, type MentoriaReport } from '@/lib/mentoria-report';
import { getGroup, groupMembers } from '@/lib/mentoria-space';

/** Dados do relatório semanal (individual m:… ou grupo g:…), para o PDF montado no aparelho. */
export async function weeklyReport(target: string, monday: string): Promise<{ report?: MentoriaReport; error?: string }> {
  try {
    await requireAdminAction();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(monday)) return { error: 'Semana inválida.' };
    const week = { from: monday, to: shift(monday, 6) };
    if (target.startsWith('g:')) {
      const g = await getGroup(target.slice(2));
      if (!g) return { error: 'Grupo não encontrado.' };
      const members = await groupMembers(g);
      const ids = (await sql.query<{ id: string }>(`select id from mentorias where id = any($1)`, [members.map((x) => emailKey(x.email))])).map((r) => r.id);
      return { report: await buildReport(ids, g.name, week) };
    }
    if (target.startsWith('m:')) {
      const m = await sql.one<{ id: string; name: string }>(`select id, coalesce(nullif(student_name, ''), student_email) as name from mentorias where id = $1`, [target.slice(2)]);
      if (!m) return { error: 'Mentoria não encontrada.' };
      return { report: await buildReport([m.id], m.name, week) };
    }
    return { error: 'Inválido.' };
  } catch {
    return { error: 'Não foi possível gerar o relatório.' };
  }
}
