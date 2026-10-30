import 'server-only';
import { emailKey, newId, sql } from '@/lib/db';
import { ASSUNTO_BY_KEY } from '@/lib/enem-matriz';
import { reschedule } from '@/lib/mentoria-data';

/**
 * Cronograma flexível: o mentor liga assuntos (e apostilas) a um dia ou a um período
 * (vários dias, uma semana, um mês). Vale para a mentoria individual (m:…) ou para o grupo (g:…).
 */
export interface BlockFile {
  id: string;
  title: string;
  file_path: string;
  size_label: string;
}

export interface Block {
  id: string;
  space: string;
  title: string;
  item_keys: string[];
  start_on: string;
  end_on: string;
  files: BlockFile[];
}

const COLS = `id, space, title, item_keys, start_on::text as start_on, end_on::text as end_on, files`;

export const blocksOf = (spaces: string[]) =>
  spaces.length ? sql.query<Block>(`select ${COLS} from mentoria_blocks where space = any($1) order by start_on desc, created_at desc`, [spaces]) : Promise.resolve([] as Block[]);

export const getBlock = (id: string) => sql.one<Block>(`select ${COLS} from mentoria_blocks where id = $1`, [id]);

/** Espaços de uma mentoria: ela mesma e o grupo de que faz parte. */
export async function spacesOfMentoria(mentoriaId: string) {
  const m = await sql.one<{ group_id: string | null }>(`select group_id from mentorias where id = $1`, [mentoriaId]);
  return [`m:${mentoriaId}`, ...(m?.group_id ? [`g:${m.group_id}`] : [])];
}

/** Mentorias que recebem os assuntos do bloco. */
async function targets(space: string): Promise<string[]> {
  if (space.startsWith('m:')) return [space.slice(2)];
  const rows = await sql.query<{ id: string }>(`select id from mentorias where group_id = $1`, [space.slice(2)]);
  return rows.map((r) => r.id);
}

/**
 * Coloca os assuntos do bloco no período em cada mentoria.
 * onlyMissing: aluno que entrou depois no grupo (não mexe no que ele já fez).
 */
export async function applyBlock(b: Block, only?: string[], onlyMissing = false) {
  const list = b.item_keys.filter((k) => ASSUNTO_BY_KEY.has(k)).map((k) => ASSUNTO_BY_KEY.get(k)!);
  for (const id of only ?? (await targets(b.space))) {
    if (list.length) {
      const max = await sql.one<{ m: number }>(`select coalesce(max(ord), -1)::int as m from mentoria_cards where mentoria_id = $1`, [id]);
      const start = (max?.m ?? -1) + 1;
      await sql.exec(
        `insert into mentoria_cards (id, mentoria_id, item_key, discipline, title, priority, ord, pinned_on, span_end, block_id, from_block)
         select v.id, $1, v.k, v.d, v.t, v.p, v.o, $7::date, $8::date, $9, true
           from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $10::int[]) as v(id, k, d, t, p, o)
         on conflict (mentoria_id, item_key) do ${
           onlyMissing
             ? // aluno novo no grupo: só pega o período nos assuntos que ainda não fez
               `update set pinned_on = excluded.pinned_on, span_end = excluded.span_end, block_id = excluded.block_id
                 where mentoria_cards.step = 'study' and mentoria_cards.attempts = 0 and mentoria_cards.block_id is null`
             : `update set pinned_on = excluded.pinned_on, span_end = excluded.span_end, block_id = excluded.block_id
                 where mentoria_cards.step = 'study'`
         }`,
        [
          id,
          list.map(() => newId()),
          list.map((x) => x.key),
          list.map((x) => x.discipline),
          list.map((x) => x.title),
          list.map((x) => x.priority),
          b.start_on,
          b.end_on,
          b.id,
          list.map((_, j) => start + j),
        ],
      );
    }
    await reschedule(id);
  }
}

/** Tira assuntos do bloco: os que entraram só por ele e nunca foram feitos saem; os outros só deixam o período. */
export async function releaseBlock(blockId: string, keys?: string[]) {
  const where = keys ? `block_id = $1 and item_key = any($2)` : `block_id = $1`;
  const args = keys ? [blockId, keys] : [blockId];
  const ids = await sql.query<{ mentoria_id: string }>(`select distinct mentoria_id from mentoria_cards where ${where}`, args);
  await sql.exec(`delete from mentoria_cards where ${where} and from_block and attempts = 0 and step = 'study'`, args);
  await sql.exec(`update mentoria_cards set pinned_on = null, span_end = null, block_id = null where ${where}`, args);
  for (const r of ids) await reschedule(r.mentoria_id);
}

/** Aluno que entrou depois no grupo recebe os períodos do grupo que ainda não terminaram. */
export async function applyGroupBlocks(groupId: string, email: string) {
  const id = emailKey(email);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const list = await sql.query<Block>(`select ${COLS} from mentoria_blocks where space = $1 and end_on >= $2`, [`g:${groupId}`, today]);
  for (const b of list) await applyBlock(b, [id], true);
}

/** Apostilas e períodos que valem num dia (para a pastinha do cronograma). */
export function blocksOnDay(list: Block[], day: string) {
  return list.filter((b) => b.start_on <= day && b.end_on >= day);
}
