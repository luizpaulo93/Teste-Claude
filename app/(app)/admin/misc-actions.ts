'use server';

import { revalidatePath } from 'next/cache';
import { bool, dateOrNull, fail, int, refreshSettings, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { EVENT_CATEGORIES, EVENT_COLORS } from '@/lib/calendar';
import { syncClaims } from '@/lib/claims';
import { db, emailKey, nowIso } from '@/lib/db';
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
      color: color in EVENT_COLORS ? color : 'blue',
      start_date,
      end_date,
      is_published: bool(fd, 'is_published'),
    };
    if (!row.title) return { error: 'Informe o título.' };
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`calendar_events/${id}`).update(row);
    } else await db().collection('calendar_events').add({ ...row, created_at: nowIso() });
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
    await db().doc(`calendar_events/${id}`).delete();
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
    await db()
      .doc('settings/platform')
      .set(
        {
          brand_name: str(fd, 'brand_name', 80) || 'CURSO VÉRTICE',
          hero_title: str(fd, 'hero_title', 160),
          hero_subtitle: str(fd, 'hero_subtitle', 240),
          hero_cta: str(fd, 'hero_cta', 60) || 'Começar agora',
          hero_bg_url: str(fd, 'hero_bg_url', 2000),
          restrict_to_student_list: bool(fd, 'restrict_to_student_list'),
          updated_at: nowIso(),
        },
        { merge: true },
      );
    refreshSettings();
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function setRoleByEmail(email: string, role: 'admin' | 'student') {
  const users = await db().collection('users').where('email', '==', email).get();
  await Promise.all(
    users.docs.map(async (u) => {
      await u.ref.update({ role });
      await syncClaims(u.id, email, role === 'admin').catch(() => null);
    }),
  );
}

export async function addAdmin(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const email = str(fd, 'email', 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: 'E-mail inválido.' };
    await db().doc(`admins/${emailKey(email)}`).set({ email, created_at: nowIso() });
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
    await db().doc(`admins/${emailKey(e)}`).delete();
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
      updated_at: nowIso(),
    };
    if (!EMAIL_RE.test(row.student_email)) return { error: 'E-mail do aluno inválido.' };
    const key = emailKey(row.student_email);
    if (id && id !== key) return { error: 'Não dá para trocar o e-mail de uma mentoria. Crie uma nova para o outro e-mail.' };
    const ref = db().doc(`mentorias/${key}`);
    if (!id && (await ref.get()).exists) return { error: 'Este aluno já tem mentoria.' };
    await ref.set(id ? row : { ...row, created_at: nowIso() }, { merge: true });
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
    const d = db();
    const [t, c, m] = await Promise.all([
      d.collection('mentoria_tasks').where('mentoria_id', '==', id).select().get(),
      d.collection('mentoria_checkins').where('mentoria_id', '==', id).select().get(),
      d.collection('mentoria_meetings').where('mentoria_id', '==', id).select().get(),
    ]);
    const refs = [...t.docs, ...c.docs, ...m.docs].map((x) => x.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const batch = d.batch();
      refs.slice(i, i + 400).forEach((r) => batch.delete(r));
      await batch.commit();
    }
    await d.doc(`mentorias/${id}`).delete();
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
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`mentoria_tasks/${id}`).update(row);
    } else await db().collection('mentoria_tasks').add({ ...row, done: false, done_at: null, created_at: nowIso() });
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
    await db().doc(`mentoria_tasks/${id}`).delete();
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
    const snap = await db().collection('mentoria_tasks').where('mentoria_id', '==', mentoriaId).where('week_start', '==', from).get();
    if (snap.empty) return { error: 'Não há tarefas nessa semana.' };
    const batch = db().batch();
    snap.docs.forEach((t) =>
      batch.set(db().collection('mentoria_tasks').doc(), {
        mentoria_id: mentoriaId,
        week_start: to,
        title: t.get('title'),
        description: t.get('description') ?? '',
        kind: t.get('kind') ?? 'outro',
        due_date: null,
        done: false,
        done_at: null,
        created_at: nowIso(),
      }),
    );
    await batch.commit();
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
    await db().doc(`mentoria_checkins/${id}`).update({ mentor_feedback: str(fd, 'mentor_feedback', 3000), feedback_at: nowIso() });
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
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`mentoria_meetings/${id}`).update(row);
    } else await db().collection('mentoria_meetings').add({ ...row, created_at: nowIso() });
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
    await db().doc(`mentoria_meetings/${id}`).delete();
    revalidatePath('/admin/mentoria', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
