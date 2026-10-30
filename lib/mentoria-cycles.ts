import 'server-only';
import { sql } from '@/lib/db';
import { newId } from '@/lib/db';
import { blocksOf, type Block } from '@/lib/mentoria-blocks';
import type { Card } from '@/lib/mentoria-data';

/**
 * Ciclos da mentoria: quando o mentor começa um ciclo novo (ex.: depois da 1ª avaliação),
 * o atual é salvo inteiro — assuntos e situação de cada um, o histórico dia a dia e as apostilas —
 * e o aluno continua acessando quando quiser. O ciclo novo vira a página inicial.
 */
export interface Cycle {
  id: string;
  mentoria_id: string;
  title: string;
  scope: 'completa' | 'especifica';
  start_date: string | null;
  end_date: string | null;
  exam_date: string | null;
  cards: Card[];
  blocks: Block[];
  created_at: string;
}

const COLS = `id, mentoria_id, title, scope, start_date::text as start_date, end_date::text as end_date, exam_date::text as exam_date, cards, blocks, created_at`;

export const cyclesOf = (mentoriaId: string) =>
  sql.query<Omit<Cycle, 'cards' | 'blocks'> & { studied: number; total: number; files: number }>(
    `select id, mentoria_id, title, scope, start_date::text as start_date, end_date::text as end_date, exam_date::text as exam_date, created_at,
            (select count(*)::int from jsonb_array_elements(cards) c where (c->>'level')::int > 0) as studied,
            jsonb_array_length(cards) as total, cardinality(file_paths) as files
       from mentoria_cycles where mentoria_id = $1 order by created_at desc`,
    [mentoriaId],
  );

export const getCycle = (id: string) => sql.one<Cycle>(`select ${COLS} from mentoria_cycles where id = $1`, [id]);

export const countCycles = async (mentoriaId: string) =>
  (await sql.one<{ n: number }>(`select count(*)::int as n from mentoria_cycles where mentoria_id = $1`, [mentoriaId]))?.n ?? 0;

/**
 * Salva o ciclo atual da mentoria e limpa o cronograma para o próximo.
 * groupBlocks: períodos do grupo (no ciclo do grupo vão junto para cada aluno).
 */
export async function archiveCycle(mentoriaId: string, groupBlocks: Block[] = []) {
  const m = await sql.one<{ exam_target: string; scope: string; start_date: string | null; end_date: string | null; exam_date: string | null }>(
    `select exam_target, scope, start_date::text as start_date, end_date::text as end_date, exam_date::text as exam_date from mentorias where id = $1`,
    [mentoriaId],
  );
  if (!m) return null;
  const cards = await sql.query<Card>(
    `select id, item_key, discipline, title, priority, ord, level, step, due_on::text as due_on, scheduled_on::text as scheduled_on, last_acc, attempts,
            history -> -1 ->> 'd' as last_day, history, pinned_on::text as pinned_on, added_by_student, span_end::text as span_end, block_id, last_feel
       from mentoria_cards where mentoria_id = $1 order by ord`,
    [mentoriaId],
  );
  const own = await blocksOf([`m:${mentoriaId}`]);
  const blocks = [...own, ...groupBlocks];
  if (!cards.length && !blocks.length) return null; // nada feito: não cria ciclo vazio
  const id = newId();
  const paths = blocks.flatMap((b) => b.files.map((f) => f.file_path));
  await sql.exec(
    `insert into mentoria_cycles (id, mentoria_id, title, scope, start_date, end_date, exam_date, cards, blocks, file_paths)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, mentoriaId, m.exam_target || 'Ciclo anterior', m.scope, m.start_date, m.end_date, m.exam_date, JSON.stringify(cards), JSON.stringify(blocks), paths],
  );
  await sql.exec(`delete from mentoria_blocks where space = $1`, [`m:${mentoriaId}`]);
  await sql.exec(`delete from mentoria_cards where mentoria_id = $1`, [mentoriaId]);
  return id;
}
