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
  // já existe a 1ª tentativa? (finalizada, ou o aluno está refazendo: "open")
  const first = await sql.one<{ open: boolean }>(`select open from list_finishes where list_id = $1 and user_id = $2`, [listId, v.userId]);
  if (list.mode === 'teste' && first && !first.open) return { error: 'Teste já finalizado.' };
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
  // também conta no banco de questões do aluno, mas só na 1ª tentativa (refazer não muda as estatísticas)
  if (!first) await sql.exec(
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
  // a 1ª vez guarda o resultado que vale para as estatísticas; nas outras só fecha a tentativa
  await sql.exec(
    `insert into list_finishes (list_id, user_id, ok, total, answers)
     values ($1, $2,
       (select count(*)::int from list_responses r where r.list_id = $1 and r.user_id = $2 and r.correct),
       (select count(*)::int from questions q where q.id = any($3::text[]) and q.status <> 'anulada'),
       coalesce((select jsonb_object_agg(r.question_id, jsonb_build_object('letter', r.letter, 'correct', r.correct))
                   from list_responses r where r.list_id = $1 and r.user_id = $2), '{}'::jsonb))
     on conflict (list_id, user_id) do update set open = false`,
    [listId, v.userId, list.question_ids],
  );
  revalidatePath(`/listas/${listId}`);
  return {};
}

/**
 * Refazer a lista: apaga as respostas desta tentativa. O resultado da 1ª tentativa fica guardado
 * (é o que conta no Desempenho e no banco de questões); as próximas não entram nas estatísticas.
 */
export async function restartList(listId: string) {
  const v = await getViewer();
  if (!v) return { error: 'Faça login.' };
  const list = await getList(listId);
  if (!list || !(await canSeeList(v, list))) return { error: 'Lista não encontrada.' };
  await sql.exec(
    `insert into list_finishes (list_id, user_id, ok, total, open, answers)
     values ($1, $2,
       (select count(*)::int from list_responses r where r.list_id = $1 and r.user_id = $2 and r.correct),
       (select count(*)::int from questions q where q.id = any($3::text[]) and q.status <> 'anulada'), true,
       coalesce((select jsonb_object_agg(r.question_id, jsonb_build_object('letter', r.letter, 'correct', r.correct))
                   from list_responses r where r.list_id = $1 and r.user_id = $2), '{}'::jsonb))
     on conflict (list_id, user_id) do update set open = true, attempts = list_finishes.attempts + 1`,
    [listId, v.userId, list.question_ids],
  );
  await sql.exec(`delete from list_responses where list_id = $1 and user_id = $2`, [listId, v.userId]);
  revalidatePath(`/listas/${listId}`);
  return {};
}
