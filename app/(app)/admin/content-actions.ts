'use server';

import { revalidatePath } from 'next/cache';
import { bool, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { byPosition, db, nowIso } from '@/lib/db';
import { removeObjects } from '@/lib/storage/server';
import type { LessonMaterial } from '@/lib/types';
import { extractYoutubeId, isDocId } from '@/lib/utils';

function revalidateContent(courseId?: string) {
  refreshCatalog();
  revalidatePath('/', 'layout');
  if (courseId) revalidatePath(`/admin/cursos/${courseId}`);
}

async function nextPosition(collection: string, field?: string, value?: string) {
  let q: FirebaseFirestore.Query = db().collection(collection);
  if (field && value) q = q.where(field, '==', value);
  const snap = await q.select('position').get();
  return snap.docs.reduce((m, d) => Math.max(m, Number(d.get('position') ?? 0)), -1) + 1;
}

// ---------------- Cursos
export async function saveCourse(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
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
      updated_at: nowIso(),
    };
    if (!row.title) return { error: 'Informe o título.' };
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await db().doc(`courses/${id}`).update(row);
      revalidateContent(id);
      return { ok: true, id };
    }
    const ref = await db().collection('courses').add({ ...row, position: await nextPosition('courses'), created_at: nowIso() });
    revalidateContent();
    return { ok: true, id: ref.id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const d = db();
    const [mods, lessons] = await Promise.all([
      d.collection('modules').where('course_id', '==', id).get(),
      d.collection('lessons').where('course_id', '==', id).get(),
    ]);
    const files = lessons.docs.flatMap((l) => ((l.get('materials') ?? []) as LessonMaterial[]).map((m) => m.file_path));
    await Promise.all(lessons.docs.map((l) => d.recursiveDelete(l.ref)));
    const batch = d.batch();
    mods.docs.forEach((m) => batch.delete(m.ref));
    batch.delete(d.doc(`courses/${id}`));
    await batch.commit();
    await removeObjects('materials', files);
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
    await requireAdminAction();
    let q: FirebaseFirestore.Query = db().collection(table);
    if (scope) q = q.where(scope.column, '==', scope.value);
    const snap = await q.select('position', 'created_at').get();
    const list = snap.docs.map((d) => ({ id: d.id, position: Number(d.get('position') ?? 0), created_at: String(d.get('created_at') ?? '') })).sort(byPosition);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    const batch = db().batch();
    list.forEach((x, idx) => x.position !== idx && batch.update(db().doc(`${table}/${x.id}`), { position: idx }));
    await batch.commit();
    revalidateContent(table === 'courses' ? undefined : scope?.column === 'course_id' ? scope.value : undefined);
    if (table === 'lessons') revalidatePath('/admin/cursos/[id]', 'page');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Módulos
export async function saveModule(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const course_id = str(fd, 'course_id', 64);
    if (!isDocId(course_id)) return { error: 'Curso inválido.' };
    const row = {
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 1500),
      is_published: bool(fd, 'is_published'),
      updated_at: nowIso(),
    };
    if (!row.title) return { error: 'Informe o nome do módulo.' };
    if (id) await db().doc(`modules/${id}`).update(row);
    else await db().collection('modules').add({ ...row, course_id, cover_url: '', position: await nextPosition('modules', 'course_id', course_id), created_at: nowIso() });
    revalidateContent(course_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteModule(id: string, courseId: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const lessons = await db().collection('lessons').where('module_id', '==', id).get();
    const files = lessons.docs.flatMap((l) => ((l.get('materials') ?? []) as LessonMaterial[]).map((m) => m.file_path));
    await Promise.all(lessons.docs.map((l) => db().recursiveDelete(l.ref)));
    await db().doc(`modules/${id}`).delete();
    await removeObjects('materials', files);
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
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const course_id = str(fd, 'course_id', 64);
    const module_id = str(fd, 'module_id', 64);
    if (!isDocId(course_id) || !isDocId(module_id)) return { error: 'Módulo inválido.' };
    let input: MaterialInput[] = [];
    try {
      input = JSON.parse(String(fd.get('materials') || '[]'));
    } catch {
      input = [];
    }
    const materials: LessonMaterial[] = input
      .filter((m) => typeof m.file_path === 'string' && /^[\w/.-]{1,300}$/.test(m.file_path))
      .slice(0, 20)
      .map((m) => ({
        id: m.id && isDocId(m.id) ? m.id : db().collection('_').doc().id,
        title: String(m.title ?? '').slice(0, 160) || 'Material',
        file_path: m.file_path,
        size_label: String(m.size_label ?? '').slice(0, 20),
      }));
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
      materials,
      material_paths: materials.map((m) => m.file_path),
      updated_at: nowIso(),
    };
    if (!row.title) return { error: 'Informe o título da aula.' };

    let lessonId = id;
    let removed: string[] = [];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      const ref = db().doc(`lessons/${id}`);
      const before = ((await ref.get()).get('materials') ?? []) as LessonMaterial[];
      removed = before.map((m) => m.file_path).filter((p) => !row.material_paths.includes(p));
      await ref.update(row);
    } else {
      const ref = await db().collection('lessons').add({ ...row, position: await nextPosition('lessons', 'module_id', module_id), created_at: nowIso() });
      lessonId = ref.id;
    }
    await removeObjects('materials', removed);
    revalidateContent(course_id);
    revalidatePath(`/aula/${lessonId}`);
    return { ok: true, id: lessonId };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLesson(id: string, courseId: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const ref = db().doc(`lessons/${id}`);
    const mats = ((await ref.get()).get('materials') ?? []) as LessonMaterial[];
    await db().recursiveDelete(ref);
    await removeObjects('materials', mats.map((m) => m.file_path));
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

export async function toggleLessonFlag(id: string, courseId: string, field: 'is_published' | 'is_free', value: boolean): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id) || !['is_published', 'is_free'].includes(field)) return { error: 'Inválido.' };
    await db().doc(`lessons/${id}`).update({ [field]: value });
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
