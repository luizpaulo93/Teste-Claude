'use server';

import { revalidatePath } from 'next/cache';
import { emailKey, newId, sql, tx } from '@/lib/db';
import { ASSUNTOS, DISCIPLINES } from '@/lib/enem-matriz';
import { afterScore, todayBR } from '@/lib/mentoria';
import { reschedule } from '@/lib/mentoria-data';
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

  // Fila de cada disciplina, intercalando uma de cada por vez
  const queues = chosen.map((k) =>
    ASSUNTOS.filter((x) => x.discipline === k).sort((x, y) => (mode === 'prioridade' ? y.priority - x.priority : 0) || x.index - y.index),
  );
  const ordered: (typeof ASSUNTOS)[number][] = [];
  for (let i = 0; queues.some((q) => q.length > i); i++) for (const q of queues) if (q[i]) ordered.push(q[i]);

  await tx(async (t) => {
    // Disciplina tirada: some só o que ainda não foi estudado
    await t.exec(`delete from mentoria_cards where mentoria_id = $1 and level = 0 and step = 'study' and not (discipline = any($2))`, [a.id, chosen]);
    for (let i = 0; i < ordered.length; i += 200) {
      const part = ordered.slice(i, i + 200);
      await t.exec(
        `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord)
         select v.id, $1, v.k, v.d, v.t, v.p, v.o
           from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[]) as v(id, k, d, t, p, o)
         on conflict (mentoria_id, item_key) do update set ord = excluded.ord, priority = excluded.priority, title = excluded.title`,
        [
          a.id,
          part.map(() => newId()),
          part.map((x) => x.key),
          part.map((x) => x.discipline),
          part.map((x) => x.title),
          part.map((x) => x.priority),
          part.map((_, j) => i + j),
        ],
      );
    }
    await t.exec(`update mentorias set plan_disciplines = $2, plan_order = $3, updated_at = now() where id = $1`, [a.id, chosen, mode]);
  });
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true, count: ordered.length };
}

// ---------------- Quadro: mover card e marcar desempenho
export async function moveCard(id: string, step: 'study' | 'questions' | 'score', mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id) || !['study', 'questions', 'score'].includes(step)) return { error: 'Sem acesso.' };
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
  mentoriaId?: string,
): Promise<Result & { level?: number; acc?: number; due?: string | null }> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id)) return { error: 'Sem acesso.' };
  const q = clampInt(questions, 0, 300);
  const c = Math.min(q, clampInt(correct, 0, 300));
  if (!q) return { error: 'Informe quantas questões você fez.' };
  const card = await sql.one<{ level: number; history: unknown[] }>(`select level, history from mentoria_cards where id = $1 and mentoria_id = $2`, [id, a.id]);
  if (!card) return { error: 'Card não encontrado.' };
  const today = todayBR();
  const r = afterScore(card.level, q, c, today);
  const history = [...(Array.isArray(card.history) ? card.history : []), { d: today, q, c, l: card.level }].slice(-30);
  await sql.exec(
    `update mentoria_cards set level = $3, step = 'study', due_on = $4, last_acc = $5, attempts = attempts + 1, history = $6, updated_at = now()
     where id = $1 and mentoria_id = $2`,
    [id, a.id, r.level, r.due, r.acc, JSON.stringify(history)],
  );
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true, level: r.level, acc: r.acc, due: r.due };
}

// ---------------- Horários do aluno
export async function saveSchedule(data: { availability: number[]; exam_date: string }, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const availability = Array.from({ length: 7 }, (_, i) => clampInt(data.availability?.[i], 0, 720));
  if (!availability.some(Boolean)) return { error: 'Informe pelo menos um dia com tempo livre.' };
  const exam = /^\d{4}-\d{2}-\d{2}$/.test(data.exam_date ?? '') ? data.exam_date : null;
  await sql.exec(
    `update mentorias set availability = $2, exam_date = $3, weekly_hours_target = greatest(1, round($4 / 60.0)),
       diagnosed_at = coalesce(diagnosed_at, now()), updated_at = now() where id = $1`,
    [a.id, JSON.stringify(availability), exam, availability.reduce((x, y) => x + y, 0)],
  );
  await reschedule(a.id);
  refresh(a.id);
  return { ok: true };
}

// ---------------- Mensagens
export async function sendMessage(text: string, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  const body = String(text ?? '').trim().slice(0, 3000);
  if (!a) return { error: 'Sem acesso.' };
  if (!body) return { error: 'Escreva a mensagem.' };
  await sql.exec(`insert into mentoria_messages (id, mentoria_id, from_mentor, author_name, text) values ($1, $2, $3, $4, $5)`, [newId(), a.id, a.mentor, a.name, body]);
  refresh(a.id);
  return { ok: true };
}

/** Marca como lidas as mensagens do outro lado. */
export async function markRead(mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  await sql.exec(`update mentoria_messages set read_at = now() where mentoria_id = $1 and from_mentor = $2 and read_at is null`, [a.id, !a.mentor]);
  return { ok: true };
}
