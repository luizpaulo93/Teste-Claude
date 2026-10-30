'use server';

import { revalidatePath } from 'next/cache';
import { emailKey, newId, sql } from '@/lib/db';
import { ASSUNTO_BY_KEY, DISCIPLINES } from '@/lib/enem-matriz';
import { afterScore, shift, todayBR } from '@/lib/mentoria';
import { reschedule, writePlan } from '@/lib/mentoria-data';
import { getViewer } from '@/lib/session';
import { isDocId } from '@/lib/utils';

type Result = { ok?: true; error?: string };

/** Quem pode mexer nesta mentoria: o próprio aluno, ou o mentor (admin) passando o ID. */
async function access(mentoriaId?: string): Promise<{ id: string; mentor: boolean; name: string } | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  if (mentoriaId && viewer.isAdmin) {
    if (mentoriaId.includes('/') || mentoriaId.length > 200) return null;
    const row = await sql.one<{ id: string }>(`select id from mentorias where id = $1`, [mentoriaId]);
    return row ? { id: row.id, mentor: true, name: viewer.profile.full_name || 'Mentor' } : null;
  }
  const row = await sql.one<{ id: string }>(`select id from mentorias where id = $1`, [emailKey(viewer.email)]);
  return row ? { id: row.id, mentor: false, name: viewer.profile.full_name || viewer.email } : null;
}

function refresh(id: string) {
  revalidatePath('/mentoria', 'layout');
  revalidatePath(`/admin/mentoria/${id}`, 'layout');
  revalidatePath('/admin/mentoria');
}

const clampInt = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

// ---------------- Mentor monta o cronograma
/**
 * O mentor escolhe as disciplinas: cada assunto vira um card, na ordem da matriz (do primeiro ao último)
 * ou com os mais cobrados no ENEM primeiro. As disciplinas se alternam ao longo dos dias.
 */
export async function buildPlan(disciplines: string[], order: 'prioridade' | 'matriz', mentoriaId: string): Promise<Result & { count?: number }> {
  const a = await access(mentoriaId);
  if (!a?.mentor) return { error: 'Só o mentor monta o cronograma.' };
  const chosen = DISCIPLINES.map((d) => d.key).filter((k) => (disciplines ?? []).includes(k));
  if (!chosen.length) return { error: 'Escolha pelo menos uma disciplina.' };
  const mode = order === 'matriz' ? 'matriz' : 'prioridade';
  const count = await writePlan(a.id, chosen, mode);
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true, count };
}

// ---------------- Quadro: mover card e marcar desempenho
/** Seta do assunto: "a estudar" → "estudado" (ou volta). */
export async function moveCard(id: string, step: 'study' | 'questions', mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id) || !['study', 'questions'].includes(step)) return { error: 'Sem acesso.' };
  const n = await sql.exec(`update mentoria_cards set step = $3, updated_at = now() where id = $1 and mentoria_id = $2`, [id, a.id, step]);
  if (!n) return { error: 'Card não encontrado.' };
  refresh(a.id);
  return { ok: true };
}

/** O aluno informa quantas questões fez e acertou; o app decide quando o assunto volta. */
export async function scoreCard(
  id: string,
  questions: number,
  correct: number,
  feel: number,
  mentoriaId?: string,
): Promise<Result & { level?: number; acc?: number; due?: string | null; passed?: boolean; goal?: number }> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id)) return { error: 'Sem acesso.' };
  const q = clampInt(questions, 0, 300);
  const c = Math.min(q, clampInt(correct, 0, 300));
  if (!q) return { error: 'Informe quantas questões você fez e quantas acertou.' };
  const f = [1, 2, 3].includes(Number(feel)) ? Number(feel) : 0;
  if (!f) return { error: 'Diga como foi o assunto: de boas, mais ou menos ou ladeira abaixo.' };
  const card = await sql.one<{ level: number; history: unknown[]; pinned_on: string | null }>(`select level, history, pinned_on::text as pinned_on from mentoria_cards where id = $1 and mentoria_id = $2`, [id, a.id]);
  if (!card) return { error: 'Card não encontrado.' };
  const today = todayBR();
  const r = afterScore(card.level, q, c, today, f);
  const history = [...(Array.isArray(card.history) ? card.history : []), { d: today, q, c, l: card.level, f, ...(card.pinned_on ? { x: 1 } : {}) }].slice(-30);
  await sql.exec(
    `update mentoria_cards set level = $3, step = 'study', due_on = $4, last_acc = $5, attempts = attempts + 1, history = $6, last_feel = $7, pinned_on = null, span_end = null, updated_at = now()
     where id = $1 and mentoria_id = $2`,
    [id, a.id, r.level, r.due, r.acc, JSON.stringify(history), f],
  );
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true, level: r.level, acc: r.acc, due: r.due, passed: r.passed, goal: r.goal };
}

// ---------------- Horários do aluno
export async function saveSchedule(data: { availability: number[] }, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const availability = Array.from({ length: 7 }, (_, i) => clampInt(data.availability?.[i], 0, 720));
  if (!availability.some(Boolean)) return { error: 'Informe pelo menos um dia com tempo livre.' };
  await sql.exec(
    `update mentorias set availability = $2, weekly_hours_target = greatest(1, round($3 / 60.0)),
       diagnosed_at = coalesce(diagnosed_at, now()), updated_at = now() where id = $1`,
    [a.id, JSON.stringify(availability), availability.reduce((x, y) => x + y, 0)],
  );
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true };
}

/**
 * Mentor escolhe à mão os assuntos do cronograma (vale também para editar o que foi gerado):
 * os desmarcados saem; os novos entram no fim da fila, mais cobrados primeiro.
 */
export async function setPlanAssuntos(keys: string[], mentoriaId: string): Promise<Result & { added?: number; removed?: number }> {
  const a = await access(mentoriaId);
  if (!a?.mentor) return { error: 'Só o mentor edita os assuntos.' };
  const wanted = new Set((keys ?? []).filter((k) => ASSUNTO_BY_KEY.has(k)));
  const current = await sql.query<{ item_key: string; ord: number }>(`select item_key, ord from mentoria_cards where mentoria_id = $1`, [a.id]);
  const have = new Set(current.map((c) => c.item_key));
  const remove = [...have].filter((k) => !wanted.has(k));
  const add = [...wanted]
    .filter((k) => !have.has(k))
    .map((k) => ASSUNTO_BY_KEY.get(k)!)
    .sort((x, y) => y.priority - x.priority || x.index - y.index);
  let ord = current.reduce((m, c) => Math.max(m, c.ord), -1) + 1;
  if (remove.length) await sql.exec(`delete from mentoria_cards where mentoria_id = $1 and item_key = any($2)`, [a.id, remove]);
  if (add.length)
    await sql.exec(
      `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord)
       select v.id, $1, v.k, v.d, v.t, v.p, v.o from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[]) as v(id, k, d, t, p, o)
       on conflict (mentoria_id, item_key) do nothing`,
      [a.id, add.map(() => newId()), add.map((x) => x.key), add.map((x) => x.discipline), add.map((x) => x.title), add.map((x) => x.priority), add.map(() => ord++)],
    );
  const discs = [...new Set([...wanted].map((k) => ASSUNTO_BY_KEY.get(k)!.discipline))];
  await sql.exec(`update mentorias set plan_disciplines = $2, updated_at = now() where id = $1`, [a.id, discs]);
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true, added: add.length, removed: remove.length };
}

// ---------------- Aluno acrescenta assuntos ao dia
/**
 * O aluno escolhe um assunto e um dia (hoje ou um dos próximos 6): ele entra nesse dia além do
 * que o mentor montou. Se o assunto ainda não estava no cronograma, passa a fazer parte dele.
 */
export async function addToDay(itemKey: string, day: string, mentoriaId?: string): Promise<Result & { day?: string }> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const item = ASSUNTO_BY_KEY.get(itemKey);
  if (!item) return { error: 'Assunto não encontrado.' };
  const today = todayBR();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || day > shift(today, 6)) return { error: 'Escolha hoje ou um dos próximos dias.' };
  const card = await sql.one<{ id: string; step: string }>(`select id, step from mentoria_cards where mentoria_id = $1 and item_key = $2`, [a.id, itemKey]);
  if (card?.step === 'questions') return { error: 'Esse assunto já está em andamento hoje.' };
  if (card) await sql.exec(`update mentoria_cards set pinned_on = $3, span_end = null, block_id = null, updated_at = now() where id = $1 and mentoria_id = $2`, [card.id, a.id, day]);
  else {
    const max = await sql.one<{ m: number }>(`select coalesce(max(ord), -1)::int as m from mentoria_cards where mentoria_id = $1`, [a.id]);
    await sql.exec(
      `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord, pinned_on, added_by_student)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (mentoria_id, item_key) do update set pinned_on = excluded.pinned_on`,
      [newId(), a.id, item.key, item.discipline, item.title, item.priority, (max?.m ?? -1) + 1, day, !a.mentor],
    );
  }
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true, day };
}

/** Tira do dia um assunto acrescentado (se nunca foi feito e entrou pelo aluno, sai do cronograma). */
export async function removeFromDay(id: string, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id)) return { error: 'Sem acesso.' };
  const del = await sql.exec(`delete from mentoria_cards where id = $1 and mentoria_id = $2 and added_by_student and block_id is null and attempts = 0 and step = 'study'`, [id, a.id]);
  if (!del) await sql.exec(`update mentoria_cards set pinned_on = null, updated_at = now() where id = $1 and mentoria_id = $2 and block_id is null`, [id, a.id]);
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true };
}
