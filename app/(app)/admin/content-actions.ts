'use server';

import { revalidatePath } from 'next/cache';
import { adminClient, bool, fail, str, type ActionResult } from '@/lib/admin/guard';
import { removeObjects } from '@/lib/storage/server';
import { extractYoutubeId } from '@/lib/utils';

function revalidateContent(courseId?: string) {
  revalidatePath('/', 'layout');
  if (courseId) revalidatePath(`/admin/cursos/${courseId}`);
}

// ---------------- Cursos
export async function saveCourse(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const row = {
      title: str(fd, 'title', 160),
      subtitle: str(fd, 'subtitle', 240),
      description: str(fd, 'description', 3000),
      category: str(fd, 'category', 80),
      cover_url: str(fd, 'cover_url', 2000),
      banner_url: str(fd, 'banner_url', 2000),
      featured: bool(fd, 'featured'),
      is_free: bool(fd, 'is_free'),
      is_published: bool(fd, 'is_published'),
      updated_at: new Date().toISOString(),
    };
    if (!row.title) return { error: 'Informe o título.' };
    if (id) {
      const { error } = await supabase.from('courses').update(row).eq('id', id);
      if (error) throw error;
      revalidateContent(id);
      return { ok: true, id };
    }
    const { data: last } = await supabase.from('courses').select('position').order('position', { ascending: false }).limit(1);
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...row, position: (last?.[0]?.position ?? 0) + 1 })
      .select('id')
      .single();
    if (error) throw error;
    revalidateContent();
    return { ok: true, id: data.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
    revalidateContent();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

/** Reordena trocando a posição com o vizinho (cima/baixo). */
export async function moveItem(table: 'courses' | 'modules' | 'lessons', id: string, dir: -1 | 1, scope?: { column: string; value: string }): Promise<ActionResult> {
  try {
    if (!['courses', 'modules', 'lessons'].includes(table)) return { error: 'Inválido' };
    if (scope && !['course_id', 'module_id'].includes(scope.column)) return { error: 'Inválido' };
    const { supabase } = await adminClient();
    let q = supabase.from(table).select('id,position').order('position').order('created_at');
    if (scope) q = q.eq(scope.column, scope.value);
    const { data } = await q;
    const list = (data ?? []) as { id: string; position: number }[];
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((x, idx) => (x.position !== idx ? supabase.from(table).update({ position: idx }).eq('id', x.id) : null)));
    revalidateContent(table === 'courses' ? undefined : scope?.value);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Módulos
export async function saveModule(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const course_id = str(fd, 'course_id', 64);
    const row = {
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 1500),
      is_published: bool(fd, 'is_published'),
      updated_at: new Date().toISOString(),
    };
    if (!row.title) return { error: 'Informe o nome do módulo.' };
    if (id) {
      const { error } = await supabase.from('modules').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { count } = await supabase.from('modules').select('id', { count: 'exact', head: true }).eq('course_id', course_id);
      const { error } = await supabase.from('modules').insert({ ...row, course_id, position: count ?? 0 });
      if (error) throw error;
    }
    revalidateContent(course_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteModule(id: string, courseId: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('modules').delete().eq('id', id);
    if (error) throw error;
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

// ---------------- Aulas
export interface MaterialInput {
  id?: string;
  title: string;
  file_path: string;
  size_label: string;
}

export async function saveLesson(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const course_id = str(fd, 'course_id', 64);
    const module_id = str(fd, 'module_id', 64);
    const row = {
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 4000),
      youtube_id: extractYoutubeId(str(fd, 'youtube', 300)),
      duration: str(fd, 'duration', 16),
      thumbnail_url: str(fd, 'thumbnail_url', 2000),
      is_free: bool(fd, 'is_free'),
      is_published: bool(fd, 'is_published'),
      module_id,
      course_id,
      updated_at: new Date().toISOString(),
    };
    if (!row.title) return { error: 'Informe o título da aula.' };
    let materials: MaterialInput[] = [];
    try {
      materials = JSON.parse(String(fd.get('materials') || '[]'));
    } catch {
      materials = [];
    }

    let lessonId = id;
    if (id) {
      const { error } = await supabase.from('lessons').update(row).eq('id', id);
      if (error) throw error;
    } else {
      const { count } = await supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('module_id', module_id);
      const { data, error } = await supabase
        .from('lessons')
        .insert({ ...row, position: count ?? 0 })
        .select('id')
        .single();
      if (error) throw error;
      lessonId = data.id;
    }

    // Sincroniza materiais (remove os que saíram, insere os novos, atualiza ordem/título)
    const { data: existing } = await supabase.from('lesson_materials').select('id,file_path').eq('lesson_id', lessonId);
    const keep = new Set(materials.filter((m) => m.id).map((m) => m.id));
    const removed = (existing ?? []).filter((m: { id: string }) => !keep.has(m.id));
    if (removed.length) {
      await supabase.from('lesson_materials').delete().in('id', removed.map((m: { id: string }) => m.id));
      await removeObjects('materials', removed.map((m: { file_path: string }) => m.file_path));
    }
    await Promise.all(
      materials.slice(0, 20).map((m, position) =>
        m.id
          ? supabase.from('lesson_materials').update({ title: m.title.slice(0, 160) || 'Material', position }).eq('id', m.id)
          : supabase.from('lesson_materials').insert({
              lesson_id: lessonId,
              title: m.title.slice(0, 160) || 'Material',
              file_path: m.file_path,
              size_label: m.size_label.slice(0, 20),
              position,
            }),
      ),
    );

    revalidateContent(course_id);
    revalidatePath(`/aula/${lessonId}`);
    return { ok: true, id: lessonId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLesson(id: string, courseId: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { data: mats } = await supabase.from('lesson_materials').select('file_path').eq('lesson_id', id);
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (error) throw error;
    if (mats?.length) await removeObjects('materials', mats.map((m: { file_path: string }) => m.file_path));
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

export async function toggleLessonFlag(id: string, courseId: string, field: 'is_published' | 'is_free', value: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('lessons').update({ [field]: value }).eq('id', id);
    if (error) throw error;
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function getMaterials(lessonId: string) {
  const { supabase } = await adminClient();
  const { data } = await supabase.from('lesson_materials').select('id,title,file_path,size_label').eq('lesson_id', lessonId).order('position');
  return (data ?? []) as MaterialInput[];
}

