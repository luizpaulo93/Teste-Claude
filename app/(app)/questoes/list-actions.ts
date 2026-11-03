'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { canSeeList, getList } from '@/lib/question-lists';
import { rich } from '@/lib/rich';
import { getViewer } from '@/lib/session';

/**
 * Resposta dentro de uma lista. No modo "lista" corrige na hora; no modo "teste" só guarda
 * (o gabarito e a resolução aparecem quando o aluno finaliza).
 */
export async function answerInList(listId: string, questionId: string, letter: string) {
  const v = await getViewer();
  if (!v) return { error: 'Faça login.' };
  const list = await getList(listId);
  if (!list || !list.question_ids.includes(questionId) || !(await canSeeList(v, list))) return { error: 'Lista não encontrada.' };
  const q = await sql.one<{ gabarito: string; status: string; resolucao: string }>(`select gabarito, status, resolucao from questions where id = $1`, [
    questionId,
  ]);
  if (!q) return { error: 'Questão não encontrada.' };
  const finished = Boolean(await sql.one(`select 1 from list_finishes where list_id = $1 and user_id = $2`, [listId, v.userId]));
  if (list.mode === 'teste' && finished) return { error: 'Teste já finalizado.' };
  const reveal = list.mode === 'lista';
  if (q.status === 'anulada') return reveal ? { status: 'anulada' as const, gabarito: '', correct: null, resolucao: rich(q.resolucao) } : { saved: true };
  const l = String(letter).toUpperCase().slice(0, 1);
  if (!/^[A-E]$/.test(l)) return { error: 'Escolha uma alternativa.' };
  const correct = l === q.gabarito;
  await sql.exec(
    `insert into list_responses (list_id, user_id, question_id, letter, correct) values ($1, $2, $3, $4, $5)
     on conflict (list_id, user_id, question_id) do update set letter = excluded.letter, correct = excluded.correct, answered_at = now()`,
    [listId, v.userId, questionId, l, correct],
  );
  // também conta no banco de questões do aluno
  await sql.exec(
    `insert into question_answers (user_id, question_id, letter, correct, first_correct) values ($1, $2, $3, $4, $4)
     on conflict (user_id, question_id) do update set letter = excluded.letter, correct = excluded.correct, attempts = question_answers.attempts + 1, answered_at = now()`,
    [v.userId, questionId, l, correct],
  );
  if (!reveal) return { saved: true };
  return { status: q.status, gabarito: q.gabarito, correct, resolucao: rich(q.resolucao) };
}

export async function finishList(listId: string) {
  const v = await getViewer();
  if (!v) return { error: 'Faça login.' };
  const list = await getList(listId);
  if (!list || !(await canSeeList(v, list))) return { error: 'Lista não encontrada.' };
  await sql.exec(`insert into list_finishes (list_id, user_id) values ($1, $2) on conflict do nothing`, [listId, v.userId]);
  revalidatePath(`/listas/${listId}`);
  return {};
}

/** Recomeçar a lista (apaga as respostas dela; no banco de questões ficam). */
export async function restartList(listId: string) {
  const v = await getViewer();
  if (!v) return { error: 'Faça login.' };
  await sql.exec(`delete from list_responses where list_id = $1 and user_id = $2`, [listId, v.userId]);
  await sql.exec(`delete from list_finishes where list_id = $1 and user_id = $2`, [listId, v.userId]);
  revalidatePath(`/listas/${listId}`);
  return {};
}
