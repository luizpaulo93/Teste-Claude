'use server';

import { sql } from '@/lib/db';
import { rich } from '@/lib/rich';
import { getViewer } from '@/lib/session';

/**
 * Responde uma questão. O gabarito e a resolução só saem do servidor aqui, depois da resposta.
 * Questão anulada: não conta, só mostra a resolução.
 */
export async function answerQuestion(id: string, letter: string) {
  const v = await getViewer();
  if (!v || !(v.isMember || v.isAdmin)) return { error: 'Acesso negado.' };
  const q = await sql.one<{ gabarito: string; status: string; resolucao: string }>(`select gabarito, status, resolucao from questions where id = $1`, [id]);
  if (!q) return { error: 'Questão não encontrada.' };
  const resolucao = rich(q.resolucao);
  if (q.status === 'anulada') return { status: 'anulada' as const, gabarito: '', correct: null, resolucao };
  const l = String(letter).toUpperCase().slice(0, 1);
  if (!/^[A-E]$/.test(l)) return { error: 'Escolha uma alternativa.' };
  const correct = l === q.gabarito;
  await sql.exec(
    `insert into question_answers (user_id, question_id, letter, correct, first_correct) values ($1, $2, $3, $4, $4)
     on conflict (user_id, question_id) do update set letter = excluded.letter, correct = excluded.correct,
       attempts = question_answers.attempts + 1, answered_at = now()`,
    [v.userId, id, l, correct],
  );
  return { status: q.status, gabarito: q.gabarito, correct, resolucao };
}
