'use server';

import { revalidatePath } from 'next/cache';
import { adminClient, bool, fail, int, str, type ActionResult } from '@/lib/admin/guard';
import { evaluateCohort } from '@/lib/tri';
import type { EnemArea } from '@/lib/types';

function refresh(id?: string) {
  revalidatePath('/admin/simulados');
  if (id) revalidatePath(`/admin/simulados/${id}`);
  revalidatePath('/simulados', 'layout');
}

export async function saveSimulado(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const area = str(fd, 'area', 2) as EnemArea;
    if (!['MT', 'CN', 'CH', 'LC'].includes(area)) return { error: 'Área inválida.' };
    const question_count = int(fd, 'question_count', 1, 180, 45);
    const row = {
      title: str(fd, 'title', 160),
      area,
      question_count,
      time_limit_minutes: int(fd, 'time_limit_minutes', 0, 600, 0),
      pdf_path: str(fd, 'pdf_path', 500),
      is_published: bool(fd, 'is_published'),
      updated_at: new Date().toISOString(),
    };
    if (!row.title) return { error: 'Informe o título.' };
    const key = str(fd, 'answer_key', 400).toUpperCase().replace(/[^A-E]/g, '');
    if (key && key.length !== question_count) return { error: `O gabarito tem ${key.length} letras, mas a prova tem ${question_count} questões.` };

    let simId = id;
    if (id) {
      const { error } = await supabase.from('simulados').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('simulados').insert(row).select('id').single();
      if (error) throw error;
      simId = data.id;
    }
    const { error: kErr } = await supabase.from('simulado_keys').upsert({ simulado_id: simId, answer_key: key });
    if (kErr) throw kErr;
    refresh(simId);
    return { ok: true, id: simId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSimulado(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { data } = await supabase.from('simulados').select('pdf_path').eq('id', id).maybeSingle();
    const { error } = await supabase.from('simulados').delete().eq('id', id);
    if (error) throw error;
    if (data?.pdf_path) await supabase.storage.from('materials').remove([data.pdf_path]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

export async function setSimuladoPublished(id: string, value: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('simulados').update({ is_published: value }).eq('id', id);
    if (error) throw error;
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Calcula as notas TRI de todos os alunos que entregaram e libera os resultados.
 * Roda uma vez (ou ao clicar em "Recalcular"); os alunos só leem o resultado pronto.
 */
export async function releaseResults(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const [{ data: sim }, { data: key }] = await Promise.all([
      supabase.from('simulados').select('id,area,question_count').eq('id', id).single(),
      supabase.from('simulado_keys').select('answer_key').eq('simulado_id', id).maybeSingle(),
    ]);
    if (!sim) return { error: 'Simulado não encontrado.' };
    if (!key?.answer_key || key.answer_key.length !== sim.question_count) return { error: 'Cadastre o gabarito completo antes de liberar.' };

    // Paginação para turmas grandes
    const subs: { user_id: string; answers: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('simulado_submissions')
        .select('user_id,answers')
        .eq('simulado_id', id)
        .eq('status', 'completed')
        .range(from, from + 999);
      if (error) throw error;
      subs.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const { rows, stats } = evaluateCohort(sim.area as EnemArea, sim.question_count, key.answer_key, subs);
    await supabase.from('simulado_results').delete().eq('simulado_id', id);
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('simulado_results').insert(rows.slice(i, i + 500).map((r) => ({ ...r, simulado_id: id, computed_at: now })));
      if (error) throw error;
    }
    const { error } = await supabase.from('simulados').update({ results_released: true, stats }).eq('id', id);
    if (error) throw error;
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Falha ao calcular resultados.');
  }
}

export async function hideResults(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('simulados').update({ results_released: false }).eq('id', id);
    if (error) throw error;
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Permite que o aluno refaça a prova (apaga a entrega e o resultado dele). */
export async function resetSubmission(simuladoId: string, userId: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    await supabase.from('simulado_results').delete().eq('simulado_id', simuladoId).eq('user_id', userId);
    const { error } = await supabase.from('simulado_submissions').delete().eq('simulado_id', simuladoId).eq('user_id', userId);
    if (error) throw error;
    refresh(simuladoId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
