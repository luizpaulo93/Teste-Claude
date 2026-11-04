import 'server-only';
import { sql } from '@/lib/db';

export type SeenSection = 'simulados' | 'calendario';

/** O aluno abriu a seção: some a bolinha de novidade. */
export async function markSeen(userId: string, section: SeenSection) {
  await sql
    .exec(`insert into seen_marks (user_id, section) values ($1, $2) on conflict (user_id, section) do update set seen_at = now()`, [userId, section])
    .catch(() => null);
}

/** Há novidade desde a última visita? (simulado publicado depois, evento criado depois) */
export async function newsFor(userId: string) {
  const r = await sql
    .one<{ simulados: boolean; calendario: boolean }>(
      `select
         coalesce((select max(published_at) from simulados where is_published)
           > coalesce((select seen_at from seen_marks where user_id = $1 and section = 'simulados'), 'epoch'), false) as simulados,
         coalesce((select max(created_at) from calendar_events where is_published)
           > coalesce((select seen_at from seen_marks where user_id = $1 and section = 'calendario'), 'epoch'), false) as calendario`,
      [userId],
    )
    .catch(() => null);
  return { simulados: Boolean(r?.simulados), calendario: Boolean(r?.calendario) };
}
