import 'server-only';
import { sql } from '@/lib/db';
import type { Mentoria, MentoriaCheckin, MentoriaError, MentoriaMeeting, MentoriaMessage, MentoriaSession, MentoriaTask } from '@/lib/types';
import { addDays } from '@/lib/utils';
import { todayBR } from '@/lib/mentoria';

export async function getMentoria(id: string) {
  const m = await sql.one<Mentoria>(`select * from mentorias where id = $1`, [id]);
  if (!m) return null;
  return { ...m, availability: Array.isArray(m.availability) ? m.availability.map(Number) : [0, 0, 0, 0, 0, 0, 0], subject_levels: m.subject_levels ?? {} } as Mentoria;
}

export const weekTasks = (id: string, week: string) =>
  sql.query<MentoriaTask>(`select * from mentoria_tasks where mentoria_id = $1 and week_start = $2 order by due_date nulls last, auto, created_at`, [id, week]);

export const recentSessions = (id: string, days = 70) =>
  sql.query<MentoriaSession>(`select * from mentoria_sessions where mentoria_id = $1 and studied_on >= $2 order by studied_on desc, created_at desc`, [
    id,
    addDays(todayBR(), -days),
  ]);

export const openErrors = (id: string) =>
  sql.query<MentoriaError>(`select * from mentoria_errors where mentoria_id = $1 order by mastered, next_review, created_at desc limit 300`, [id]);

export const messages = (id: string) =>
  sql.query<MentoriaMessage>(`select * from (select * from mentoria_messages where mentoria_id = $1 order by created_at desc limit 150) x order by created_at`, [id]);

export const unreadCount = async (id: string, forMentor: boolean) =>
  (await sql.one<{ n: number }>(`select count(*)::int as n from mentoria_messages where mentoria_id = $1 and from_mentor = $2 and read_at is null`, [id, !forMentor]))?.n ?? 0;

export const checkins = (id: string) => sql.query<MentoriaCheckin>(`select * from mentoria_checkins where mentoria_id = $1 order by week_start desc limit 20`, [id]);

export const upcomingMeetings = (id: string) =>
  sql.query<MentoriaMeeting>(`select * from mentoria_meetings where (mentoria_id = $1 or mentoria_id is null) and starts_at >= $2 order by starts_at limit 6`, [
    id,
    new Date(Date.now() - 3 * 3600_000).toISOString(),
  ]);

/** Notas dos simulados do aluno (pelo e-mail da mentoria). */
export const simuladoScores = (email: string) =>
  sql.query<{ title: string; tri_score: number; accuracy: number; use_tri: boolean; simulado_id: string }>(
    `select s.title, r.tri_score, r.accuracy, s.use_tri, s.id as simulado_id
       from simulado_results r join simulados s on s.id = r.simulado_id and s.results_released
       join users u on u.id = r.user_id
      where lower(u.email) = lower($1)
      order by s.created_at`,
    [email],
  );

/** Conteúdos da matriz já marcados pelo aluno (chave → 1 estudado, 2 dominado). */
export async function topicStatus(id: string): Promise<Record<string, number>> {
  const rows = await sql.query<{ item_key: string; status: number }>(`select item_key, status from mentoria_topics where mentoria_id = $1`, [id]);
  return Object.fromEntries(rows.map((r) => [r.item_key, Number(r.status)]));
}
