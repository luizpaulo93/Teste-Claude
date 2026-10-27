'use server';

import { revalidatePath } from 'next/cache';
import { adminClient, bool, dateOrNull, fail, int, str, type ActionResult } from '@/lib/admin/guard';
import { EVENT_CATEGORIES, EVENT_COLORS } from '@/lib/calendar';

// ---------------- Calendário
export async function saveEvent(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
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
    const { error } = id ? await supabase.from('calendar_events').update(row).eq('id', id) : await supabase.from('calendar_events').insert(row);
    if (error) throw error;
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
    const { supabase } = await adminClient();
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
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
    const { supabase } = await adminClient();
    const { error } = await supabase
      .from('platform_settings')
      .update({
        brand_name: str(fd, 'brand_name', 80) || 'CURSO VÉRTICE',
        hero_title: str(fd, 'hero_title', 160),
        hero_subtitle: str(fd, 'hero_subtitle', 240),
        hero_cta: str(fd, 'hero_cta', 60) || 'Começar agora',
        hero_bg_url: str(fd, 'hero_bg_url', 2000),
        restrict_to_student_list: bool(fd, 'restrict_to_student_list'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) throw error;
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addAdmin(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const email = str(fd, 'email', 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-mail inválido.' };
    const { error } = await supabase.from('admin_emails').upsert({ email });
    if (error) throw error;
    // Se a pessoa já tem conta, promove agora
    await supabase.from('profiles').update({ role: 'admin' }).eq('email', email);
    revalidatePath('/admin/config');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeAdmin(email: string): Promise<ActionResult> {
  try {
    const { supabase, viewer } = await adminClient();
    if (email.toLowerCase() === viewer.email) return { error: 'Você não pode remover a si mesmo.' };
    await supabase.from('admin_emails').delete().eq('email', email);
    await supabase.from('profiles').update({ role: 'student' }).eq('email', email);
    revalidatePath('/admin/config');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Mentoria
export async function saveMentoria(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.student_email)) return { error: 'E-mail do aluno inválido.' };
    if (id) {
      const { error } = await supabase.from('mentorias').update(row).eq('id', id);
      if (error) throw error;
      revalidatePath(`/admin/mentoria/${id}`);
    } else {
      const { data, error } = await supabase.from('mentorias').insert(row).select('id').single();
      if (error) throw error;
      revalidatePath('/admin/mentoria');
      return { ok: true, id: data.id };
    }
    revalidatePath('/admin/mentoria');
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMentoria(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('mentorias').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/mentoria');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveTask(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const mentoria_id = str(fd, 'mentoria_id', 64);
    const kind = str(fd, 'kind', 20);
    const row = {
      mentoria_id,
      week_start: dateOrNull(fd, 'week_start'),
      title: str(fd, 'title', 200),
      description: str(fd, 'description', 1000),
      kind: ['aula', 'questoes', 'simulado', 'revisao', 'outro'].includes(kind) ? kind : 'outro',
      due_date: dateOrNull(fd, 'due_date'),
    };
    if (!row.title || !row.week_start) return { error: 'Informe o título e a semana.' };
    const { error } = id ? await supabase.from('mentoria_tasks').update(row).eq('id', id) : await supabase.from('mentoria_tasks').insert(row);
    if (error) throw error;
    revalidatePath(`/admin/mentoria/${mentoria_id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string, mentoriaId: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('mentoria_tasks').delete().eq('id', id);
    if (error) throw error;
    revalidatePath(`/admin/mentoria/${mentoriaId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Copia as tarefas de uma semana para a seguinte (sem marcar como feitas). */
export async function copyWeek(mentoriaId: string, from: string, to: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { data } = await supabase.from('mentoria_tasks').select('title,description,kind').eq('mentoria_id', mentoriaId).eq('week_start', from);
    if (!data?.length) return { error: 'Não há tarefas nessa semana.' };
    const { error } = await supabase.from('mentoria_tasks').insert(data.map((t) => ({ ...t, mentoria_id: mentoriaId, week_start: to })));
    if (error) throw error;
    revalidatePath(`/admin/mentoria/${mentoriaId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveFeedback(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const mentoriaId = str(fd, 'mentoria_id', 64);
    const { error } = await supabase
      .from('mentoria_checkins')
      .update({ mentor_feedback: str(fd, 'mentor_feedback', 3000), feedback_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    revalidatePath(`/admin/mentoria/${mentoriaId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveMeeting(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const mentoria_id = str(fd, 'mentoria_id', 64) || null;
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
    const { error } = id ? await supabase.from('mentoria_meetings').update(row).eq('id', id) : await supabase.from('mentoria_meetings').insert(row);
    if (error) throw error;
    revalidatePath('/admin/mentoria', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMeeting(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('mentoria_meetings').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/mentoria', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
