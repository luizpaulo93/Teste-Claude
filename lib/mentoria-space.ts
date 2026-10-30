import 'server-only';
import { applyGroupBlocks } from '@/lib/mentoria-blocks';
import { emailKey, sql } from '@/lib/db';
import { appendCards, reschedule, syncCards } from '@/lib/mentoria-data';
import type { Viewer } from '@/lib/session';

/**
 * "Espaços" da mentoria: onde ficam dúvidas e lives.
 * m:<id> = mentoria individual · g:<id> = mentoria em grupo.
 */
export interface Space {
  key: string;
  label: string;
}

export interface MentoriaGroup {
  id: string;
  name: string;
  description: string;
  student_emails: string[];
  class_ids: string[];
  exam_target: string;
  exam_date: string | null;
  start_date: string;
  end_date: string | null;
  plan_disciplines: string[];
  plan_order: string;
  plan_keys: string[];
  scope: 'completa' | 'especifica';
}

export const getGroup = (id: string) =>
  sql.one<MentoriaGroup>(
    `select id, name, description, student_emails, class_ids, exam_target, exam_date::text as exam_date, start_date::text as start_date,
            end_date::text as end_date, plan_disciplines, plan_order, plan_keys, scope from mentoria_groups where id = $1`,
    [id],
  );

/** Alunos do grupo: os escolhidos um a um + os das turmas escolhidas (ativos). */
export async function groupMembers(g: Pick<MentoriaGroup, 'student_emails' | 'class_ids'>) {
  return sql.query<{ email: string; name: string; class_id: string | null }>(
    `select s.email, coalesce(nullif(s.name, ''), u.full_name, s.email) as name, s.class_id
       from students s left join lateral (select full_name from users where lower(email) = s.email limit 1) u on true
      where s.email = any($1) or (s.class_id = any($2) and s.status = 'active')
     union
     select e, e, null from unnest($1::text[]) e where not exists (select 1 from students s where s.email = e)
     order by 2`,
    [g.student_emails, g.class_ids],
  );
}

/** Espaços que o usuário pode ver (admin: todos). */
export async function spacesFor(viewer: Viewer): Promise<Space[]> {
  const out: Space[] = [];
  if (viewer.mentoriaGroups.length) {
    const gs = await sql.query<{ id: string; name: string }>(`select id, name from mentoria_groups where id = any($1) order by name`, [viewer.mentoriaGroups]);
    out.push(...gs.map((g) => ({ key: `g:${g.id}`, label: g.name })));
  }
  const own = await sql.one<{ id: string }>(`select id from mentorias where id = $1`, [emailKey(viewer.email)]);
  if (own) out.push({ key: `m:${own.id}`, label: out.length ? 'Só com o mentor' : 'Individual' });
  return out;
}

export async function canUseSpace(viewer: Viewer, space: string) {
  if (!/^[mg]:[^/]{1,200}$/.test(space)) return false;
  if (viewer.isAdmin) return true;
  if (space.startsWith('g:')) return viewer.mentoriaGroups.includes(space.slice(2));
  return space.slice(2) === emailKey(viewer.email) && Boolean(await sql.one(`select 1 from mentorias where id = $1`, [space.slice(2)]));
}

/**
 * Aplica o grupo nos alunos: cria a mentoria de quem ainda não tem (ligada ao grupo, com as datas do grupo).
 * Os assuntos só são iguais na primeira geração: quem ainda não tem cronograma recebe o do grupo;
 * depois cada aluno segue o seu (revisões e ritmo pelo próprio rendimento). Mudanças nos assuntos do grupo
 * só acrescentam os novos e tiram os que o aluno ainda não estudou, sem refazer o cronograma de ninguém.
 */
export async function syncGroup(groupId: string, onlyEmail?: string, delta?: { add: string[]; remove: string[] }) {
  const g = await getGroup(groupId);
  if (!g) return 0;
  const members = (await groupMembers(g)).filter((m) => !onlyEmail || m.email === onlyEmail);
  let n = 0;
  for (const m of members) {
    const id = emailKey(m.email);
    await sql.exec(
      `insert into mentorias (id, student_email, student_name, status, exam_target, exam_date, start_date, end_date, group_id, scope)
       values ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set exam_target = excluded.exam_target, exam_date = excluded.exam_date, start_date = excluded.start_date,
         end_date = excluded.end_date, scope = excluded.scope, updated_at = now()
       where mentorias.group_id = $8`,
      [id, m.email, m.name, g.exam_target, g.exam_date, g.start_date, g.end_date, g.id, g.scope],
    );
    const own = await sql.one<{ group_id: string | null }>(`select group_id from mentorias where id = $1`, [id]);
    if (own?.group_id !== g.id) continue;
    const has = await sql.one<{ n: number }>(`select count(*)::int as n from mentoria_cards where mentoria_id = $1`, [id]);
    if (!has?.n) {
      if (g.plan_keys.length) await syncCards(id, g.plan_keys);
    } else if (delta) {
      if (delta.remove.length) await sql.exec(`delete from mentoria_cards where mentoria_id = $1 and item_key = any($2) and level = 0 and attempts = 0`, [id, delta.remove]);
      if (delta.add.length) await appendCards(id, delta.add);
    }
    await applyGroupBlocks(g.id, m.email);
    await reschedule(id);
    n++;
  }
  return n;
}

/** Aluno que entrou no grupo (ex.: pela turma) e ainda não tem cronograma: cria na hora. */
export async function ensureGroupMember(viewer: Viewer) {
  if (!viewer.mentoriaGroups.length) return;
  const has = await sql.one(`select 1 from mentorias where id = $1`, [emailKey(viewer.email)]);
  if (!has) await syncGroup(viewer.mentoriaGroups[0], viewer.email);
}

/** Dúvidas da mentoria ainda sem resposta do mentor, por espaço. */
export async function pendingDoubts(): Promise<Map<string, number>> {
  const rows = await sql.query<{ space: string; n: number }>(
    `select d.space, count(*)::int as n from doubts d
      where d.space is not null and not d.is_resolved
        and not exists (select 1 from doubt_replies r where r.doubt_id = d.id and r.author_role = 'admin')
      group by d.space`,
  );
  return new Map(rows.map((r) => [r.space, r.n]));
}
