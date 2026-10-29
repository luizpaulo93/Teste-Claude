'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { bool, dateOrNull, fail, int, refreshSettings, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { EVENT_CATEGORIES, EVENT_COLORS, eventColor } from '@/lib/calendar';
import { emailKey, newId, sql, tx } from '@/lib/db';
import { BOOTSTRAP_ADMIN } from '@/lib/session';
import { isDocId } from '@/lib/utils';

const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

// ---------------- Calendário
export async function saveEvent(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const start_date = dateOrNull(fd, 'start_date');
    const end_date = dateOrNull(fd, 'end_date') ?? start_date;
    if (!start_date || !end_date) return { error: 'Informe as datas.' };
    if (end_date < start_date) return { error: 'A data final deve ser depois da inicial.' };
    const category = str(fd, 'category', 30);
    const color = str(fd, 'color', 20);
    const row = {
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 2000),
      category: category in EVENT_CATEGORIES ? category : 'evento_curso',
      color: eventColor(category, color in EVENT_COLORS ? color : 'blue'),
      start_date,
      end_date,
      is_published: bool(fd, 'is_published'),
    };
    if (!row.title) return { error: 'Informe o título.' };
    const values = [row.title, row.description, row.category, row.color, row.start_date, row.end_date, row.is_published];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update calendar_events set title = $2, description = $3, category = $4, color = $5, start_date = $6, end_date = $7, is_published = $8 where id = $1`,
        [id, ...values],
      );
    } else {
      await sql.exec(
        `insert into calendar_events (id, title, description, category, color, start_date, end_date, is_published) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newId(), ...values],
      );
    }
    revalidatePath('/calendario');
    revalidatePath('/admin/calendario');
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`delete from calendar_events where id = $1`, [id]);
    revalidatePath('/calendario');
    revalidatePath('/admin/calendario');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Configurações
export async function saveSettings(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const data = {
      brand_name: str(fd, 'brand_name', 80) || 'CURSO VÉRTICE',
      hero_title: str(fd, 'hero_title', 160),
      hero_subtitle: str(fd, 'hero_subtitle', 240),
      hero_cta: str(fd, 'hero_cta', 60) || 'Começar agora',
      hero_bg_url: str(fd, 'hero_bg_url', 2000),
      restrict_to_student_list: bool(fd, 'restrict_to_student_list'),
    };
    await sql.exec(
      `insert into settings (id, data) values ('platform', $1) on conflict (id) do update set data = settings.data || excluded.data, updated_at = now()`,
      [JSON.stringify(data)],
    );
    refreshSettings();
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function setRoleByEmail(email: string, role: 'admin' | 'student') {
  await sql.exec(`update users set role = $2 where email = $1`, [email, role]);
  updateTag('viewers');
}

export async function addAdmin(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const email = str(fd, 'email', 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'E-mail inválido.' };
    await sql.exec(`insert into admins (email) values ($1) on conflict do nothing`, [email]);
    await setRoleByEmail(email, 'admin');
    revalidatePath('/admin/config');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeAdmin(email: string): Promise<ActionResult> {
  try {
    const viewer = await requireAdminAction();
    const e = String(email).toLowerCase();
    if (e === viewer.email) return { error: 'Você não pode remover a si mesmo.' };
    if (e === BOOTSTRAP_ADMIN) return { error: 'Este é o administrador principal.' };
    await sql.exec(`delete from admins where email = $1`, [e]);
    await setRoleByEmail(e, 'student');
    revalidatePath('/admin/config');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------- Mentoria (o ID da mentoria é o e-mail do aluno)
export async function saveMentoria(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 200);
    const status = str(fd, 'status', 10);
    const row = {
      student_email: str(fd, 'student_email', 200).toLowerCase(),
      student_name: str(fd, 'student_name', 160),
      status: ['active', 'paused', 'ended'].includes(status) ? status : 'active',
      goal: str(fd, 'goal', 600),
      exam_target: str(fd, 'exam_target', 120),
      weekly_hours_target: int(fd, 'weekly_hours_target', 0, 100, 20),
      start_date: dateOrNull(fd, 'start_date') ?? new Date().toISOString().slice(0, 10),
      end_date: dateOrNull(fd, 'end_date'),
    };
    if (!EMAIL_RE.test(row.student_email)) return { error: 'E-mail do aluno inválido.' };
    const key = emailKey(row.student_email);
    if (id && id !== key) return { error: 'Não dá para trocar o e-mail de uma mentoria. Crie uma nova para o outro e-mail.' };
    const values = [key, row.student_email, row.student_name, row.status, row.goal, row.exam_target, row.weekly_hours_target, row.start_date, row.end_date];
    if (id) {
      await sql.exec(
        `update mentorias set student_email = $2, student_name = $3, status = $4, goal = $5, exam_target = $6, weekly_hours_target = $7,
           start_date = $8, end_date = $9, updated_at = now() where id = $1`,
        values,
      );
    } else {
      const n = await sql.exec(
        `insert into mentorias (id, student_email, student_name, status, goal, exam_target, weekly_hours_target, start_date, end_date)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict do nothing`,
        values,
      );
      if (!n) return { error: 'Este aluno já tem mentoria.' };
    }
    updateTag('viewers');
    revalidatePath('/admin/mentoria');
    revalidatePath(`/admin/mentoria/${key}`);
    return { ok: true, id: key };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMentoria(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!id || id.includes('/')) return { error: 'Inválido.' };
    await sql.exec(`delete from mentorias where id = $1`, [id]); // tarefas, check-ins e encontros vão junto
    updateTag('viewers');
    revalidatePath('/admin/mentoria');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveTask(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const mentoria_id = str(fd, 'mentoria_id', 200);
    const kind = str(fd, 'kind', 20);
    const row = {
      mentoria_id,
      week_start: dateOrNull(fd, 'week_start'),
      title: str(fd, 'title', 200),
      description: str(fd, 'description', 1000),
      kind: ['aula', 'questoes', 'simulado', 'revisao', 'outro'].includes(kind) ? kind : 'outro',
      due_date: dateOrNull(fd, 'due_date'),
    };
    if (!row.title || !row.week_start || !mentoria_id) return { error: 'Informe o título e a semana.' };
    const values = [row.mentoria_id, row.week_start, row.title, row.description, row.kind, row.due_date];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update mentoria_tasks set mentoria_id = $2, week_start = $3, title = $4, description = $5, kind = $6, due_date = $7 where id = $1`,
        [id, ...values],
      );
    } else {
      await sql.exec(
        `insert into mentoria_tasks (id, mentoria_id, week_start, title, description, kind, due_date) values ($1, $2, $3, $4, $5, $6, $7)`,
        [newId(), ...values],
      );
    }
    revalidatePath(`/admin/mentoria/${mentoria_id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string, mentoriaId: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`delete from mentoria_tasks where id = $1`, [id]);
    revalidatePath(`/admin/mentoria/${mentoriaId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Copia as tarefas de uma semana para a seguinte (sem marcar como feitas). */
export async function copyWeek(mentoriaId: string, from: string, to: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Semana inválida.' };
    const tasks = await sql.query<{ title: string; description: string; kind: string }>(
      `select title, description, kind from mentoria_tasks where mentoria_id = $1 and week_start = $2 order by created_at`,
      [mentoriaId, from],
    );
    if (!tasks.length) return { error: 'Não há tarefas nessa semana.' };
    await tx(async (t) => {
      for (const task of tasks) {
        await t.exec(
          `insert into mentoria_tasks (id, mentoria_id, week_start, title, description, kind) values ($1, $2, $3, $4, $5, $6)`,
          [newId(), mentoriaId, to, task.title, task.description, task.kind],
        );
      }
    });
    revalidatePath(`/admin/mentoria/${mentoriaId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveFeedback(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 260);
    const mentoriaId = str(fd, 'mentoria_id', 200);
    if (!id || id.includes('/')) return { error: 'Inválido.' };
    await sql.exec(`update mentoria_checkins set mentor_feedback = $2, feedback_at = now() where id = $1`, [id, str(fd, 'mentor_feedback', 3000)]);
    revalidatePath(`/admin/mentoria/${mentoriaId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveMeeting(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const mentoria_id = str(fd, 'mentoria_id', 200) || null;
    const startsLocal = str(fd, 'starts_at', 20);
    const tz = str(fd, 'tz_offset', 6);
    const starts = new Date(`${startsLocal}:00${/^[+-]\d{2}:\d{2}$/.test(tz) ? tz : '-03:00'}`);
    if (Number.isNaN(starts.getTime())) return { error: 'Data/hora inválida.' };
    const link = str(fd, 'link', 500);
    if (link && !/^https:\/\//.test(link)) return { error: 'O link deve começar com https://' };
    const row = {
      mentoria_id,
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 1000),
      starts_at: starts.toISOString(),
      duration_min: int(fd, 'duration_min', 5, 600, 60),
      link,
      notes: str(fd, 'notes', 3000),
    };
    if (!row.title) return { error: 'Informe o título.' };
    const values = [row.mentoria_id, row.title, row.description, row.starts_at, row.duration_min, row.link, row.notes];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update mentoria_meetings set mentoria_id = $2, title = $3, description = $4, starts_at = $5, duration_min = $6, link = $7, notes = $8 where id = $1`,
        [id, ...values],
      );
    } else {
      await sql.exec(
        `insert into mentoria_meetings (id, mentoria_id, title, description, starts_at, duration_min, link, notes) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newId(), ...values],
      );
    }
    revalidatePath('/admin/mentoria', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMeeting(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`delete from mentoria_meetings where id = $1`, [id]);
    revalidatePath('/admin/mentoria', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
