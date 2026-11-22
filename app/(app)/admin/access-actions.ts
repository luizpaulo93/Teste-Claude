'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { fail, requireAdminAction, type ActionResult } from '@/lib/admin/guard';
import { emailKey, sql } from '@/lib/db';
import { appendCards, orderedKeys, reschedule, writePlan } from '@/lib/mentoria-data';
import { BOOTSTRAP_ADMIN } from '@/lib/session';
import { DISCIPLINES } from '@/lib/trilha-catalog';
import { isDocId } from '@/lib/utils';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]{2,}$/;

/** O que a pessoa tem liberado hoje (módulo por módulo). */
export interface Access {
  email: string;
  name: string;
  avatar: string;
  isAdmin: boolean;
  /** turma (cursos, aulas, ao vivo, simulados, desempenho) */
  classId: string | null;
  blocked: boolean;
  /** mentoria própria ativa */
  mentoria: boolean;
  /** mentoria que vem de um grupo (não se desliga por aqui) */
  mentoriaGroup: string | null;
  /** banco de questões e geração de listas */
  questoes: boolean;
}

export interface AccessInput {
  classId: string | null;
  mentoria: boolean;
  questoes: boolean;
}

export async function getAccess(rawEmail: string): Promise<{ access?: Access; error?: string }> {
  try {
    await requireAdminAction();
    const email = String(rawEmail ?? '')
      .trim()
      .toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'E-mail inválido.' };
    const key = emailKey(email);
    const r = await sql.one<{
      name: string;
      avatar: string;
      role: string | null;
      admin: boolean;
      class_id: string | null;
      status: string | null;
      questoes: boolean | null;
      has_student: boolean;
      mentoria: string | null;
      grp: string | null;
    }>(
      `select coalesce(nullif(s.name, ''), u.full_name, '') as name, coalesce(u.avatar_url, '') as avatar, u.role,
              exists(select 1 from admins a where a.email = $1) as admin,
              s.class_id, s.status, s.questoes, s.id is not null as has_student,
              (select m.status from mentorias m where m.id = $2) as mentoria,
              (select g.name from mentoria_groups g
                where $2 = any(g.student_emails) or (s.status = 'active' and s.class_id = any(g.class_ids)) limit 1) as grp
         from (select 1) x
         left join users u on lower(u.email) = $1
         left join students s on s.id = $2
        limit 1`,
      [email, key],
    );
    const isAdmin = email === BOOTSTRAP_ADMIN || r?.role === 'admin' || Boolean(r?.admin);
    const active = r?.status === 'active';
    return {
      access: {
        email,
        name: r?.name ?? '',
        avatar: r?.avatar ?? '',
        isAdmin,
        classId: r?.class_id ?? null,
        blocked: r?.status === 'blocked',
        mentoria: r?.mentoria === 'active',
        mentoriaGroup: r?.grp ?? null,
        // sem marca própria: segue a turma (quem tem turma e está liberado tem questões)
        questoes: r?.questoes === true ? active : r?.questoes === false ? false : Boolean(active && r?.class_id),
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Libera para cada e-mail exatamente os módulos escolhidos.
 * Turma e questões ficam no cadastro de aluno; mentoria cria (ou reativa) a mentoria completa, ou pausa.
 */
export async function saveAccess(rawEmails: string[], input: AccessInput): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdminAction();
    const emails = [...new Set(rawEmails.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))].slice(0, 2000);
    if (!emails.length) return { error: 'Escolha pelo menos uma pessoa.' };
    const classId = input.classId && isDocId(input.classId) ? input.classId : null;
    if (input.classId && !classId) return { error: 'Turma inválida.' };
    if (classId && !(await sql.one(`select 1 from classes where id = $1`, [classId]))) return { error: 'Turma não encontrada.' };
    const admins = new Set(
      (await sql.query<{ email: string }>(`select email from admins where email = any($1) union select lower(email) from users where role = 'admin' and lower(email) = any($1)`, [emails])).map(
        (a) => a.email,
      ),
    );
    admins.add(BOOTSTRAP_ADMIN);
    const people = emails.filter((e) => !admins.has(e));
    if (!people.length) return { error: 'Administrador já tem acesso a tudo.' };
    const questoes = Boolean(input.questoes);

    for (const email of people) {
      const key = emailKey(email);
      const name = (await sql.one<{ n: string }>(`select coalesce(full_name, '') as n from users where lower(email) = $1 limit 1`, [email]))?.n ?? '';
      // Turma e questões: o cadastro de aluno guarda os dois (sem nada liberado, só tira o que tinha)
      if (classId || questoes) {
        await sql.exec(
          `insert into students (id, email, name, class_id, status, questoes) values ($1, $2, $3, $4, 'active', $5)
           on conflict (id) do update set class_id = excluded.class_id, status = 'active', questoes = excluded.questoes,
             name = case when students.name = '' then excluded.name else students.name end, updated_at = now()`,
          [key, email, name, classId, questoes],
        );
      } else {
        await sql.exec(`update students set class_id = null, questoes = false, updated_at = now() where id = $1`, [key]);
      }
      // Mentoria
      if (input.mentoria) {
        await sql.exec(
          `insert into mentorias (id, student_email, student_name, status, scope) values ($1, $2, $3, 'active', 'completa')
           on conflict (id) do update set status = 'active', updated_at = now()`,
          [key, email, name],
        );
        // mentoria nova (ou sem cronograma): todos os assuntos, os mais cobrados primeiro
        const all = DISCIPLINES.map((d) => d.key);
        if (!(await sql.one(`select 1 from mentoria_cards where mentoria_id = $1 limit 1`, [key]))) await writePlan(key, all, 'prioridade');
        else if ((await sql.one<{ scope: string }>(`select scope from mentorias where id = $1`, [key]))?.scope === 'completa')
          await appendCards(key, orderedKeys(all, 'prioridade'));
        await reschedule(key);
      } else {
        await sql.exec(`update mentorias set status = 'paused', updated_at = now() where id = $1 and status = 'active'`, [key]);
      }
    }
    updateTag('viewers');
    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');
    return { ok: true, count: people.length };
  } catch (e) {
    return fail(e);
  }
}
