import 'server-only';
import { newId, sql } from '@/lib/db';

/** Lista de verificação da mentoria: 6 questões do assunto. */
export const CHECK_SIZE = 6;
/** Acertos para passar (4 de 6). Abaixo disso o app cria outra lista do mesmo assunto. */
export const CHECK_PASS = 4;
/** Quantas listas seguidas do mesmo assunto, no máximo. */
export const CHECK_MAX_ROUNDS = 5;

export interface MentoriaCheck {
  id: string;
  mentoria_id: string;
  discipline: string;
  assunto: string;
  list_id: string;
  round: number;
  auto: boolean;
  status: 'open' | 'passed' | 'failed';
  ok: number | null;
  total: number | null;
  created_at: string;
  finished_at: string | null;
}

export const checksOf = (mentoriaId: string) =>
  sql.query<MentoriaCheck>(`select * from mentoria_checks where mentoria_id = $1 order by created_at desc, round desc limit 60`, [mentoriaId]);

/** Assuntos que têm questões no banco (para o mentor escolher). */
export const checkOptions = () =>
  sql.query<{ disciplina: string; assunto: string; n: number }>(
    `select disciplina, assunto_geral as assunto, count(*)::int as n from questions
      where status <> 'anulada' and disciplina <> '' and assunto_geral <> '' group by 1, 2 order by 1, 2`,
  );

/**
 * Cria a lista de verificação: 6 questões do assunto, de preferência as que o aluno ainda não viu
 * nas listas anteriores do mesmo assunto. Vai só para o aluno da mentoria (teste com resolução liberada).
 */
export async function createCheck(input: { mentoriaId: string; discipline: string; assunto: string; round?: number; auto?: boolean; by?: string }) {
  const used = (
    await sql.query<{ id: string }>(
      `select distinct unnest(l.question_ids) as id from mentoria_checks c join question_lists l on l.id = c.list_id
        where c.mentoria_id = $1 and c.discipline = $2 and c.assunto = $3`,
      [input.mentoriaId, input.discipline, input.assunto],
    )
  ).map((r) => r.id);
  // novas primeiro; se o banco não tiver 6 novas, completa com as já vistas
  const rows = await sql.query<{ id: string }>(
    `select id from questions where status <> 'anulada' and disciplina = $1 and assunto_geral = $2
      order by (id = any($3::text[])), random() limit ${CHECK_SIZE}`,
    [input.discipline, input.assunto, used],
  );
  if (!rows.length) return { error: 'Não há questões deste assunto no banco.' };
  const round = input.round ?? 1;
  const listId = newId();
  await sql.exec(
    `insert into question_lists (id, title, question_ids, mode, audience, resolution_released, created_by)
     values ($1, $2, $3, 'teste', $4, true, $5)`,
    [listId, `Verificação · ${input.assunto}${round > 1 ? ` (${round}ª lista)` : ''}`.slice(0, 120), rows.map((r) => r.id), [`u:${input.mentoriaId}`], input.by ?? null],
  );
  const id = newId();
  await sql.exec(`insert into mentoria_checks (id, mentoria_id, discipline, assunto, list_id, round, auto) values ($1, $2, $3, $4, $5, $6, $7)`, [
    id,
    input.mentoriaId,
    input.discipline,
    input.assunto,
    listId,
    round,
    Boolean(input.auto),
  ]);
  return { id, listId, count: rows.length };
}

/**
 * O aluno finalizou uma lista: se for de verificação, guarda o resultado; com muitos erros
 * (menos de 4 acertos em 6), cria sozinho a próxima lista do mesmo assunto.
 */
export async function afterListFinished(listId: string, ok: number, total: number) {
  const c = await sql.one<MentoriaCheck>(`select * from mentoria_checks where list_id = $1 and status = 'open'`, [listId]);
  if (!c) return null;
  // proporcional quando a lista tem menos de 6 questões válidas
  const need = Math.ceil((CHECK_PASS / CHECK_SIZE) * Math.max(1, total));
  const passed = ok >= need;
  await sql.exec(`update mentoria_checks set status = $2, ok = $3, total = $4, finished_at = now() where id = $1`, [c.id, passed ? 'passed' : 'failed', ok, total]);
  if (passed || c.round >= CHECK_MAX_ROUNDS) return { check: true as const, passed, ok, total, next: null };
  const n = await createCheck({ mentoriaId: c.mentoria_id, discipline: c.discipline, assunto: c.assunto, round: c.round + 1, auto: true });
  return { check: true as const, passed, ok, total, next: 'listId' in n ? n.listId! : null };
}
