'use server';

import { revalidatePath } from 'next/cache';
import { emailKey, newId, sql, tx } from '@/lib/db';
import { ALL_ITEM_KEYS, nextTopic } from '@/lib/enem-matriz';
import { planWeek, REVIEW_STEPS, SUBJECTS, todayBR } from '@/lib/mentoria';
import { getViewer } from '@/lib/session';
import { addDays, isDocId, weekStart } from '@/lib/utils';

type Result = { ok?: true; error?: string };

/**
 * Quem pode mexer nesta mentoria: o próprio aluno, ou o admin (mentor) passando o ID.
 * Devolve o ID da mentoria e se quem age é o mentor.
 */
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
  revalidatePath(`/admin/mentoria/${id}`);
  revalidatePath('/admin/mentoria');
}

const clampInt = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
const subjectOk = (s: unknown) => (SUBJECTS as readonly string[]).includes(String(s)) ? String(s) : '';

// ---------------- Plano da semana
export async function toggleTask(taskId: string, done: boolean, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(taskId)) return { error: 'Sem acesso.' };
  const n = await sql.exec(
    `update mentoria_tasks set done = $3, done_at = case when $3 then now() else null end where id = $1 and mentoria_id = $2`,
    [taskId, a.id, done],
  );
  if (n) refresh(a.id);
  return n ? { ok: true } : { error: 'Sem acesso.' };
}

/** Monta (ou refaz) o cronograma automático da semana. Tarefas manuais e as já feitas ficam. */
export async function generateWeek(week: string, mentoriaId?: string): Promise<Result & { count?: number }> {
  const a = await access(mentoriaId);
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return { error: 'Sem acesso.' };
  const m = await sql.one<{ availability: number[]; subject_levels: Record<string, number> }>(`select availability, subject_levels from mentorias where id = $1`, [a.id]);
  if (!m) return { error: 'Mentoria não encontrada.' };
  const start = weekStart(new Date(`${week}T12:00:00`));
  const due = await sql.one<{ n: number }>(`select count(*)::int as n from mentoria_errors where mentoria_id = $1 and not mastered and next_review <= $2`, [a.id, addDays(start, 6)]);
  const today = todayBR();
  const fromDay = start <= today && today <= addDays(start, 6) ? Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000) : start < today ? 7 : 0;
  const marks = await sql.query<{ item_key: string; status: number }>(`select item_key, status from mentoria_topics where mentoria_id = $1`, [a.id]);
  const status = Object.fromEntries(marks.map((r) => [r.item_key, Number(r.status)]));
  const plan = planWeek(m, due?.n ?? 0, fromDay, (s) => nextTopic(s, status));
  if (!plan.length) return { error: fromDay >= 7 ? 'Essa semana já passou.' : 'Preencha os horários disponíveis no diagnóstico.' };
  await tx(async (t) => {
    await t.exec(`delete from mentoria_tasks where mentoria_id = $1 and week_start = $2 and auto and not done`, [a.id, start]);
    for (const p of plan) {
      await t.exec(
        `insert into mentoria_tasks (id, mentoria_id, week_start, title, description, kind, due_date, subject, minutes, auto)
         values ($1, $2, $3, $4, '', $5, $6, $7, $8, true)`,
        [newId(), a.id, start, p.title, p.kind, addDays(start, p.day), p.subject, p.minutes],
      );
    }
  });
  refresh(a.id);
  return { ok: true, count: plan.length };
}

// ---------------- Diagnóstico
export async function saveDiagnosis(
  data: { target_course: string; target_score: number; exam_date: string; availability: number[]; levels: Record<string, number> },
  mentoriaId?: string,
): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const availability = Array.from({ length: 7 }, (_, i) => clampInt(data.availability?.[i], 0, 720));
  const levels: Record<string, number> = {};
  for (const s of SUBJECTS) levels[s] = clampInt(data.levels?.[s] ?? 3, 1, 5);
  const exam = /^\d{4}-\d{2}-\d{2}$/.test(data.exam_date ?? '') ? data.exam_date : null;
  await sql.exec(
    `update mentorias set target_course = $2, target_score = $3, exam_date = $4, availability = $5, subject_levels = $6,
       weekly_hours_target = greatest(1, round($7 / 60.0)), diagnosed_at = coalesce(diagnosed_at, now()), updated_at = now()
     where id = $1`,
    [a.id, String(data.target_course ?? '').slice(0, 120), clampInt(data.target_score, 0, 1000), exam, JSON.stringify(availability), JSON.stringify(levels), availability.reduce((x, y) => x + y, 0)],
  );
  // Ainda sem cronograma automático nesta semana: já monta (mantém as tarefas do mentor)
  const week = weekStart(new Date(`${todayBR()}T12:00:00`));
  const has = await sql.one(`select 1 from mentoria_tasks where mentoria_id = $1 and week_start = $2 and auto limit 1`, [a.id, week]);
  if (!has) await generateWeek(week, mentoriaId);
  refresh(a.id);
  return { ok: true };
}

// ---------------- Estudo (cronômetro e questões)
export async function logSession(data: { subject: string; minutes: number; questions: number; correct: number; date?: string }, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const minutes = clampInt(data.minutes, 0, 720);
  const questions = clampInt(data.questions, 0, 500);
  const correct = Math.min(questions, clampInt(data.correct, 0, 500));
  if (!minutes && !questions) return { error: 'Informe o tempo ou as questões.' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date ?? '') ? data.date! : todayBR();
  await sql.exec(
    `insert into mentoria_sessions (id, mentoria_id, subject, minutes, questions, correct, studied_on) values ($1, $2, $3, $4, $5, $6, $7)`,
    [newId(), a.id, subjectOk(data.subject), minutes, questions, correct, date],
  );
  refresh(a.id);
  return { ok: true };
}

export async function deleteSession(id: string, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id)) return { error: 'Sem acesso.' };
  await sql.exec(`delete from mentoria_sessions where id = $1 and mentoria_id = $2`, [id, a.id]);
  refresh(a.id);
  return { ok: true };
}

// ---------------- Caderno de erros
export async function addError(
  data: { subject: string; topic: string; question: string; reason: string; answer: string; image_url: string },
  mentoriaId?: string,
): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const subject = subjectOk(data.subject);
  if (!subject) return { error: 'Escolha a matéria.' };
  if (!String(data.question ?? '').trim() && !data.image_url) return { error: 'Descreva a questão ou envie uma foto.' };
  const reason = ['conteudo', 'atencao', 'interpretacao', 'tempo', 'chute'].includes(data.reason) ? data.reason : 'conteudo';
  const img = /^https?:\/\//.test(data.image_url ?? '') ? data.image_url.slice(0, 1000) : '';
  await sql.exec(
    `insert into mentoria_errors (id, mentoria_id, subject, topic, question, reason, answer, image_url, next_review)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [newId(), a.id, subject, String(data.topic ?? '').slice(0, 160), String(data.question ?? '').slice(0, 3000), reason, String(data.answer ?? '').slice(0, 3000), img, addDays(todayBR(), REVIEW_STEPS[0])],
  );
  refresh(a.id);
  return { ok: true };
}

/** Revisão: acertou → próxima etapa (1, 7, 15, 30 dias); errou → volta para amanhã. */
export async function reviewError(id: string, gotIt: boolean, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id)) return { error: 'Sem acesso.' };
  const e = await sql.one<{ stage: number }>(`select stage from mentoria_errors where id = $1 and mentoria_id = $2`, [id, a.id]);
  if (!e) return { error: 'Não encontrado.' };
  const stage = gotIt ? e.stage + 1 : 0;
  const mastered = stage >= REVIEW_STEPS.length;
  const next = addDays(todayBR(), REVIEW_STEPS[Math.min(stage, REVIEW_STEPS.length - 1)]);
  await sql.exec(`update mentoria_errors set stage = $3, mastered = $4, next_review = $5 where id = $1 and mentoria_id = $2`, [id, a.id, stage, mastered, next]);
  refresh(a.id);
  return { ok: true };
}

export async function deleteError(id: string, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a || !isDocId(id)) return { error: 'Sem acesso.' };
  await sql.exec(`delete from mentoria_errors where id = $1 and mentoria_id = $2`, [id, a.id]);
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

// ---------------- Check-in semanal
export async function saveCheckin(week: string, data: { hours_studied: number; questions_done: number; focus_rating: number; wins: string; difficulties: string }) {
  const a = await access();
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return { error: 'Sem acesso.' };
  // O feedback do mentor nunca é alterado pelo aluno
  await sql.exec(
    `insert into mentoria_checkins (id, mentoria_id, week_start, hours_studied, questions_done, focus_rating, wins, difficulties)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set hours_studied = excluded.hours_studied, questions_done = excluded.questions_done,
       focus_rating = excluded.focus_rating, wins = excluded.wins, difficulties = excluded.difficulties, updated_at = now()`,
    [
      `${a.id}_${week}`,
      a.id,
      week,
      Math.min(168, Math.max(0, Number(data.hours_studied) || 0)),
      clampInt(data.questions_done, 0, 5000),
      clampInt(data.focus_rating || 3, 1, 5),
      String(data.wins ?? '').slice(0, 1500),
      String(data.difficulties ?? '').slice(0, 1500),
    ],
  );
  refresh(a.id);
  return { ok: true };
}

// ---------------- Conteúdos da Matriz de Referência do ENEM
const VALID_KEYS = new Set(ALL_ITEM_KEYS);

/** Marca conteúdos como não estudado (0), estudado (1) ou dominado (2). */
export async function setTopicStatus(keys: string[], status: 0 | 1 | 2, mentoriaId?: string): Promise<Result> {
  const a = await access(mentoriaId);
  if (!a) return { error: 'Sem acesso.' };
  const list = [...new Set((keys ?? []).filter((k) => VALID_KEYS.has(k)))].slice(0, 400);
  if (!list.length) return { error: 'Conteúdo inválido.' };
  if (status === 0) await sql.exec(`delete from mentoria_topics where mentoria_id = $1 and item_key = any($2)`, [a.id, list]);
  else
    await sql.exec(
      `insert into mentoria_topics (mentoria_id, item_key, status) select $1, k, $3 from unnest($2::text[]) as k
       on conflict (mentoria_id, item_key) do update set status = greatest(mentoria_topics.status, excluded.status), updated_at = now()`,
      [a.id, list, status === 2 ? 2 : 1],
    );
  refresh(a.id);
  return { ok: true };
}
