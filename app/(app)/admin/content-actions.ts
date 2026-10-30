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
  module_lessons: `select coalesce(max(position), -1) + 1 as p from module_lessons where module_id = $1`,
  folder: `select coalesce(max(position), -1) + 1 as p from lessons where folder_id is not distinct from $1`,
};

async function nextPosition(table: keyof typeof POSITION_SQL, scope?: string | null) {
  const row = await sql.one<{ p: number }>(POSITION_SQL[table], scope !== undefined ? [scope] : []);
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
      '',
      str(fd, 'cover_url', 2000),
      str(fd, 'banner_url', 2000),
      bool(fd, 'featured'),
      bool(fd, 'is_free'),
      bool(fd, 'is_published'),
    ];
    // Só tags que o admin criou
    const wanted = fd.getAll('tag_ids').map(String).slice(0, 30);
    const tagIds = wanted.length ? (await sql.query<{ id: string }>(`select id from course_tags where id = any($1)`, [wanted])).map((t) => t.id) : [];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update courses set title = $2, subtitle = $3, description = $4, category = $5, cover_url = $6, banner_url = $7,
           featured = $8, is_free = $9, is_published = $10, tag_ids = $11, updated_at = now() where id = $1`,
        [id, ...values, tagIds],
      );
      revalidateContent(id);
      return { ok: true, id };
    }
    const newCourse = newId();
    await sql.exec(
      `insert into courses (id, title, subtitle, description, category, cover_url, banner_url, featured, is_free, is_published, position, tag_ids)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [newCourse, ...values, await nextPosition('courses'), tagIds],
    );
    revalidateContent();
    return { ok: true, id: newCourse };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Tags de disciplina (filtro do catálogo)
export async function saveTag(id: string | null, name: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const n = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!n) return { error: 'Dê um nome à tag.' };
    const dup = await sql.one(`select 1 from course_tags where lower(name) = lower($1) and id <> coalesce($2, '')`, [n, id]);
    if (dup) return { error: 'Já existe uma tag com esse nome.' };
    if (id) await sql.exec(`update course_tags set name = $2 where id = $1`, [id, n]);
    else await sql.exec(`insert into course_tags (id, name, position) select $1, $2, coalesce(max(position), -1) + 1 from course_tags`, [newId(), n]);
    revalidateContent();
    revalidatePath('/admin/cursos');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTag(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    await sql.exec(`update courses set tag_ids = array_remove(tag_ids, $1) where $1 = any(tag_ids)`, [id]);
    await sql.exec(`delete from course_tags where id = $1`, [id]);
    revalidateContent();
    revalidatePath('/admin/cursos');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Muda a ordem das tags no filtro (sobe ou desce uma posição). */
export async function moveTag(id: string, dir: -1 | 1): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const list = await sql.query<{ id: string }>(`select id from course_tags order by position, lower(name)`);
    const i = list.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    await sql.exec(`update course_tags t set position = v.p from unnest($1::text[], $2::int[]) as v(id, p) where t.id = v.id`, [list.map((t) => t.id), list.map((_, k) => k)]);
    revalidateContent();
    revalidatePath('/admin/cursos');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    // Os módulos vão junto; as aulas continuam no banco de aulas (podem estar em outros cursos)
    await sql.exec(`delete from courses where id = $1`, [id]);
    revalidateContent();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

/** Reordena trocando a posição com o vizinho (cima/baixo). */
export async function moveItem(table: 'courses' | 'modules', id: string, dir: -1 | 1, scope?: { column: string; value: string }): Promise<ActionResult> {
  try {
    if (!['courses', 'modules'].includes(table)) return { error: 'Inválido' };
    if (scope && scope.column !== 'course_id') return { error: 'Inválido' };
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
    revalidateContent(table === 'courses' ? undefined : scope?.value);
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
    const cover = str(fd, 'cover_url', 2000);
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(`update modules set title = $2, description = $3, is_published = $4, cover_url = $5, updated_at = now() where id = $1`, [
        id,
        title,
        description,
        published,
        cover,
      ]);
    } else {
      await sql.exec(
        `insert into modules (id, course_id, title, description, is_published, position, cover_url) values ($1, $2, $3, $4, $5, $6, $7)`,
        [newId(), course_id, title, description, published, await nextPosition('modules', course_id), cover],
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
    await sql.exec(`delete from modules where id = $1`, [id]); // as aulas continuam no banco de aulas
    revalidateContent(courseId);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

// ---------------- Banco de aulas (com pastas, como no MemberClass)
export interface MaterialInput {
  id?: string;
  title: string;
  file_path: string;
  size_label: string;
}

const PATH_RE = /^[\w/.-]{1,300}$/;

function cleanMaterials(input: unknown): LessonMaterial[] {
  return (Array.isArray(input) ? (input as MaterialInput[]) : [])
    .filter((m) => typeof m?.file_path === 'string' && PATH_RE.test(m.file_path))
    .slice(0, 30)
    .map((m) => ({
      id: m.id && isDocId(m.id) ? m.id : newId(),
      title: String(m.title ?? '').slice(0, 160) || 'Material',
      file_path: m.file_path,
      size_label: String(m.size_label ?? '').slice(0, 20),
    }));
}

function refreshLessons(courseId?: string) {
  revalidateContent(courseId);
  revalidatePath('/admin/aulas');
  revalidatePath('/admin/cursos/[id]', 'page');
}

/** Cria ou edita uma aula do banco. Se vier `add_to_module`, a aula nova já entra no fim desse módulo. */
export async function saveLesson(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const folderRaw = str(fd, 'folder_id', 64);
    const folderId = isDocId(folderRaw) ? folderRaw : null;
    const addTo = str(fd, 'add_to_module', 64);
    let input: unknown = [];
    try {
      input = JSON.parse(String(fd.get('materials') || '[]'));
    } catch {
      input = [];
    }
    const materials = cleanMaterials(input);
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
      folderId,
      JSON.stringify(materials),
      paths,
    ];

    let lessonId = id;
    let removed: string[] = [];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      const before = await sql.one<{ materials: LessonMaterial[]; folder_id: string | null }>(`select materials, folder_id from lessons where id = $1`, [id]);
      if (!before) return { error: 'Aula não encontrada.' };
      removed = filesOf([before]).filter((p) => !paths.includes(p));
      const folderChanged = (before.folder_id ?? null) !== folderId;
      await sql.exec(
        `update lessons set title = $2, description = $3, youtube_id = $4, duration = $5, thumbnail_url = $6, is_free = $7, is_published = $8,
           folder_id = $9, materials = $10, material_paths = $11, updated_at = now()
           ${folderChanged ? ', position = (select coalesce(max(position), -1) + 1 from lessons where folder_id is not distinct from $9)' : ''}
         where id = $1`,
        [id, ...values],
      );
    } else {
      lessonId = newId();
      await tx(async (t) => {
        await t.exec(
          `insert into lessons (id, title, description, youtube_id, duration, thumbnail_url, is_free, is_published, folder_id, materials, material_paths, position)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             (select coalesce(max(position), -1) + 1 from lessons where folder_id is not distinct from $9))`,
          [lessonId, ...values],
        );
        if (isDocId(addTo)) {
          await t.exec(
            `insert into module_lessons (module_id, lesson_id, position)
             select $1, $2, coalesce(max(position), -1) + 1 from module_lessons where module_id = $1`,
            [addTo, lessonId],
          );
        }
      });
    }
    await removeObjects('materials', removed);
    refreshLessons();
    revalidatePath(`/aula/${lessonId}`);
    return { ok: true, id: lessonId };
  } catch (e) {
    return fail(e);
  }
}

/** Apaga a aula de vez (sai de todos os cursos) e os PDFs dela. */
export async function deleteLesson(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const row = await sql.one<{ materials: LessonMaterial[] }>(`delete from lessons where id = $1 returning materials`, [id]);
    await removeObjects('materials', filesOf(row ? [row] : []));
    refreshLessons();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

export async function toggleLessonFlag(id: string, field: 'is_published' | 'is_free', value: boolean): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id) || !['is_published', 'is_free'].includes(field)) return { error: 'Inválido.' };
    await sql.exec(`update lessons set ${field} = $2, updated_at = now() where id = $1`, [id, value]);
    refreshLessons();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Sobe/desce uma aula dentro da pasta. */
export async function moveLessonInFolder(id: string, dir: -1 | 1): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await tx(async (t) => {
      const me = await t.one<{ folder_id: string | null }>(`select folder_id from lessons where id = $1`, [id]);
      if (!me) return;
      const list = await t.query<{ id: string }>(
        `select id from lessons where folder_id is not distinct from $1 order by position, created_at for update`,
        [me.folder_id],
      );
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await t.exec(
        `update lessons l set position = v.pos - 1 from unnest($1::text[]) with ordinality as v(id, pos) where l.id = v.id and l.position <> v.pos - 1`,
        [list.map((x) => x.id)],
      );
    });
    revalidatePath('/admin/aulas');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Transfere aulas para outra pasta (ou para "sem pasta"). */
export async function moveLessonsToFolder(ids: string[], folderId: string | null): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const safe = ids.filter((x) => isDocId(x)).slice(0, 500);
    const folder = folderId && isDocId(folderId) ? folderId : null;
    if (!safe.length) return { ok: true };
    await sql.exec(
      `update lessons l set folder_id = $2, position = base.p + v.pos - 1
         from unnest($1::text[]) with ordinality as v(id, pos),
              (select coalesce(max(position), -1) + 1 as p from lessons where folder_id is not distinct from $2) base
        where l.id = v.id`,
      [safe, folder],
    );
    revalidatePath('/admin/aulas');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Pastas
export async function saveFolder(id: string, name: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const n = String(name ?? '').trim().slice(0, 120);
    if (!n) return { error: 'Informe o nome da pasta.' };
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(`update lesson_folders set name = $2 where id = $1`, [id, n]);
    } else {
      const folderId = newId();
      await sql.exec(`insert into lesson_folders (id, name, position) select $1, $2, coalesce(max(position), -1) + 1 from lesson_folders`, [folderId, n]);
      revalidatePath('/admin/aulas');
      return { ok: true, id: folderId };
    }
    revalidatePath('/admin/aulas');
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

/** Apaga a pasta; as aulas dela vão para "sem pasta" (nada é perdido). */
export async function deleteFolder(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`delete from lesson_folders where id = $1`, [id]);
    revalidatePath('/admin/aulas');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function moveFolder(id: string, dir: -1 | 1): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await tx(async (t) => {
      const list = await t.query<{ id: string }>(`select id from lesson_folders order by position, created_at for update`);
      const i = list.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await t.exec(`update lesson_folders f set position = v.pos - 1 from unnest($1::text[]) with ordinality as v(id, pos) where f.id = v.id`, [list.map((x) => x.id)]);
    });
    revalidatePath('/admin/aulas');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Montagem do módulo (aulas escolhidas do banco)
export async function addLessonsToModule(moduleId: string, lessonIds: string[]): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const safe = [...new Set(lessonIds.filter((x) => isDocId(x)))].slice(0, 500);
    if (!isDocId(moduleId) || !safe.length) return { ok: true };
    const mod = await sql.one<{ course_id: string }>(`select course_id from modules where id = $1`, [moduleId]);
    if (!mod) return { error: 'Módulo não encontrado.' };
    await sql.exec(
      `insert into module_lessons (module_id, lesson_id, position)
       select $1, v.id, base.p + v.pos - 1
         from unnest($2::text[]) with ordinality as v(id, pos),
              (select coalesce(max(position), -1) + 1 as p from module_lessons where module_id = $1) base
       on conflict do nothing`,
      [moduleId, safe],
    );
    refreshLessons(mod.course_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Tira a aula do módulo (ela continua no banco de aulas). */
export async function removeLessonFromModule(moduleId: string, lessonId: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(moduleId) || !isDocId(lessonId)) return { error: 'Inválido.' };
    await sql.exec(`delete from module_lessons where module_id = $1 and lesson_id = $2`, [moduleId, lessonId]);
    refreshLessons();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function moveLessonInModule(moduleId: string, lessonId: string, dir: -1 | 1): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(moduleId) || !isDocId(lessonId)) return { error: 'Inválido.' };
    await tx(async (t) => {
      const list = await t.query<{ lesson_id: string }>(
        `select ml.lesson_id from module_lessons ml join lessons l on l.id = ml.lesson_id where ml.module_id = $1 order by ml.position, l.created_at for update of ml`,
        [moduleId],
      );
      const i = list.findIndex((x) => x.lesson_id === lessonId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await t.exec(
        `update module_lessons ml set position = v.pos - 1 from unnest($2::text[]) with ordinality as v(id, pos)
          where ml.module_id = $1 and ml.lesson_id = v.id and ml.position <> v.pos - 1`,
        [moduleId, list.map((x) => x.lesson_id)],
      );
    });
    refreshLessons();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
