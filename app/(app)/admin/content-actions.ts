'use server';

import { revalidatePath } from 'next/cache';
import { bool, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { newId, sql, tx } from '@/lib/db';
import { removeObjects } from '@/lib/storage/server';
import type { LessonMaterial } from '@/lib/types';
import { extractYoutubeId, isDocId } from '@/lib/utils';

function revalidateContent(courseId?: string) {
  refreshCatalog();
  revalidatePath('/', 'layout');
  if (courseId) revalidatePath(`/admin/cursos/${courseId}`);
}

const POSITION_SQL = {
  courses: `select coalesce(max(position), -1) + 1 as p from courses`,
  modules: `select coalesce(max(position), -1) + 1 as p from modules where course_id = $1`,
  lessons: `select coalesce(max(position), -1) + 1 as p from lessons where module_id = $1`,
};

async function nextPosition(table: keyof typeof POSITION_SQL, scope?: string) {
  const row = await sql.one<{ p: number }>(POSITION_SQL[table], scope ? [scope] : []);
  return row?.p ?? 0;
}

function filesOf(rows: { materials: LessonMaterial[] | null }[]) {
  return rows.flatMap((r) => (r.materials ?? []).map((m) => m.file_path));
}

// ---------------- Cursos
export async function saveCourse(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const title = str(fd, 'title', 160);
    if (!title) return { error: 'Informe o título.' };
    const values = [
      title,
      str(fd, 'subtitle', 240),
      str(fd, 'description', 3000),
      str(fd, 'category', 80),
      str(fd, 'cover_url', 2000),
      str(fd, 'banner_url', 2000),
      bool(fd, 'featured'),
      bool(fd, 'is_free'),
      bool(fd, 'is_published'),
    ];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update courses set title = $2, subtitle = $3, description = $4, category = $5, cover_url = $6, banner_url = $7,
           featured = $8, is_free = $9, is_published = $10, updated_at = now() where id = $1`,
        [id, ...values],
      );
      revalidateContent(id);
      return { ok: true, id };
    }
    const newCourse = newId();
    await sql.exec(
      `insert into courses (id, title, subtitle, description, category, cover_url, banner_url, featured, is_free, is_published, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [newCourse, ...values, await nextPosition('courses')],
    );
    revalidateContent();
    return { ok: true, id: newCourse };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    // Módulos, aulas e comentários são apagados junto (on delete cascade)
    const lessons = await sql.query<{ materials: LessonMaterial[] }>(`select materials from lessons where course_id = $1`, [id]);
    await sql.exec(`delete from courses where id = $1`, [id]);
    await removeObjects('materials', filesOf(lessons));
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
    if (scope && !isDocId(scope.value)) return { error: 'Inválido' };
    if (!isDocId(id)) return { error: 'Inválido' };
    // Troca a posição com o vizinho e renumera a lista (0, 1, 2…) numa transação
    await tx(async (t) => {
      const list = await t.query<{ id: string }>(
        `select id from ${table} ${scope ? `where ${scope.column} = $1` : ''} order by position, created_at for update`,
        scope ? [scope.value] : [],
      );
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await t.exec(
        `update ${table} t set position = v.pos - 1 from unnest($1::text[]) with ordinality as v(id, pos) where t.id = v.id and t.position <> v.pos - 1`,
        [list.map((x) => x.id)],
      );
    });
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
    const title = str(fd, 'title', 160);
    if (!title) return { error: 'Informe o nome do módulo.' };
    const description = str(fd, 'description', 1500);
    const published = bool(fd, 'is_published');
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(`update modules set title = $2, description = $3, is_published = $4, updated_at = now() where id = $1`, [id, title, description, published]);
    } else {
      await sql.exec(
        `insert into modules (id, course_id, title, description, is_published, position) values ($1, $2, $3, $4, $5, $6)`,
        [newId(), course_id, title, description, published, await nextPosition('modules', course_id)],
      );
    }
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
    const lessons = await sql.query<{ materials: LessonMaterial[] }>(`select materials from lessons where module_id = $1`, [id]);
    await sql.exec(`delete from modules where id = $1`, [id]);
    await removeObjects('materials', filesOf(lessons));
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
        id: m.id && isDocId(m.id) ? m.id : newId(),
        title: String(m.title ?? '').slice(0, 160) || 'Material',
        file_path: m.file_path,
        size_label: String(m.size_label ?? '').slice(0, 20),
      }));
    const title = str(fd, 'title', 160);
    if (!title) return { error: 'Informe o título da aula.' };
    const paths = materials.map((m) => m.file_path);
    const values = [
      title,
      str(fd, 'description', 4000),
      extractYoutubeId(str(fd, 'youtube', 300)),
      str(fd, 'duration', 16),
      str(fd, 'thumbnail_url', 2000),
      bool(fd, 'is_free'),
      bool(fd, 'is_published'),
      module_id,
      course_id,
      JSON.stringify(materials),
      paths,
    ];

    let lessonId = id;
    let removed: string[] = [];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      const before = await sql.one<{ materials: LessonMaterial[] }>(`select materials from lessons where id = $1`, [id]);
      removed = filesOf(before ? [before] : []).filter((p) => !paths.includes(p));
      await sql.exec(
        `update lessons set title = $2, description = $3, youtube_id = $4, duration = $5, thumbnail_url = $6, is_free = $7, is_published = $8,
           module_id = $9, course_id = $10, materials = $11, material_paths = $12, updated_at = now() where id = $1`,
        [id, ...values],
      );
    } else {
      lessonId = newId();
      await sql.exec(
        `insert into lessons (id, title, description, youtube_id, duration, thumbnail_url, is_free, is_published, module_id, course_id, materials, material_paths, position)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [lessonId, ...values, await nextPosition('lessons', module_id)],
      );
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
    const row = await sql.one<{ materials: LessonMaterial[] }>(`delete from lessons where id = $1 returning materials`, [id]);
    await removeObjects('materials', filesOf(row ? [row] : []));
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
    await sql.exec(`update lessons set ${field} = $2, updated_at = now() where id = $1`, [id, value]);
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
