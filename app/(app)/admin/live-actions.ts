'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { bool, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { newId, sql } from '@/lib/db';
import { extractYoutubeId, isDocId } from '@/lib/utils';
import type { LessonMaterial } from '@/lib/types';
import { createBroadcast, endBroadcast, getAccount, oauthConfigured, saveAccount, setIngest } from '@/lib/youtube';

function refresh(id?: string) {
  updateTag('lives');
  if (id) updateTag(`live-${id}`);
  revalidatePath('/admin/ao-vivo');
  revalidatePath('/', 'layout');
}

export async function saveLive(fd: FormData): Promise<ActionResult> {
  try {
    await requireAdminAction();
    const id = str(fd, 'id', 64);
    const startsLocal = str(fd, 'starts_at', 20);
    const tz = str(fd, 'tz_offset', 6);
    const starts = new Date(`${startsLocal}:00${/^[+-]\d{2}:\d{2}$/.test(tz) ? tz : '-03:00'}`);
    if (Number.isNaN(starts.getTime())) return { error: 'Data/hora inválida.' };
    // Público: vazio = todos os alunos liberados; ou turmas, alunos, mentorias e cursos escolhidos
    const audience = [...new Set(fd.getAll('audience').map(String))].filter((t) => /^(c|u|m|g|course):[^/]{1,200}$/.test(t)).slice(0, 200);
    const space = audience.find((t) => /^[mg]:/.test(t)) ?? null;
    const courseId = '';
    const title = str(fd, 'title', 160);
    if (!title) return { error: 'Informe o título.' };
    const values = [
      title,
      str(fd, 'description', 2000),
      extractYoutubeId(str(fd, 'youtube', 300)),
      str(fd, 'cover_url', 2000),
      isDocId(courseId) ? courseId : null,
      starts.toISOString(),
      bool(fd, 'show_replay'),
      bool(fd, 'chat_enabled'),
      bool(fd, 'is_published'),
    ];
    if (id) {
      if (!isDocId(id)) return { error: 'Inválido.' };
      await sql.exec(
        `update live_sessions set title = $2, description = $3, youtube_id = $4, cover_url = $5, course_id = $6, starts_at = $7,
           show_replay = $8, chat_enabled = $9, is_published = $10, space = $11, audience = $12, updated_at = now() where id = $1`,
        [id, ...values, space, audience],
      );
    } else {
      await sql.exec(
        `insert into live_sessions (id, title, description, youtube_id, cover_url, course_id, starts_at, show_replay, chat_enabled, is_published, space, audience)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [newId(), ...values, space, audience],
      );
    }
    refresh(id || undefined);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLiveStatus(id: string, status: 'scheduled' | 'live' | 'ended'): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id) || !['scheduled', 'live', 'ended'].includes(status)) return { error: 'Inválido.' };
    const live = await sql.one<{ youtube_id: string }>(`select youtube_id from live_sessions where id = $1`, [id]);
    if (!live) return { error: 'Transmissão não encontrada.' };
    if (status === 'live' && !live.youtube_id) return { error: 'Cole o link da transmissão do YouTube antes de iniciar.' };
    await sql.exec(`update live_sessions set status = $2, updated_at = now() where id = $1`, [id, status]);
    // Encerrou: o link vira aula normal do YouTube na pasta "Lives"
    if (status === 'ended') await archiveAsLesson(id).catch(() => {});
    // Os alunos na sala percebem a mudança na próxima consulta (alguns segundos)
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLive(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    await sql.exec(`delete from live_sessions where id = $1`, [id]); // mensagens vão junto
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}

/** Nome da pasta da live no banco de aulas: "Lives · <turma/aluno/mentoria>" (ou só "Lives" quando é para todos). */
async function folderName(audience: string[]) {
  if (!audience.length) return 'Lives';
  const labels: string[] = [];
  for (const t of audience.slice(0, 4)) {
    const [kind, ...rest] = t.split(':');
    const id = rest.join(':');
    const row =
      kind === 'c'
        ? await sql.one<{ n: string }>(`select name as n from classes where id = $1`, [id])
        : kind === 'g'
          ? await sql.one<{ n: string }>(`select name as n from mentoria_groups where id = $1`, [id])
          : kind === 'm'
            ? await sql.one<{ n: string }>(`select 'Mentoria ' || coalesce(nullif(student_name, ''), student_email) as n from mentorias where id = $1`, [id])
            : kind === 'u'
              ? await sql.one<{ n: string }>(`select coalesce(nullif(name, ''), email) as n from students where id = $1`, [id])
              : await sql.one<{ n: string }>(`select title as n from courses where id = $1`, [id]);
    labels.push(row?.n || (kind === 'u' ? id : 'removido'));
  }
  return `Lives · ${labels.join(', ')}${audience.length > 4 ? ` +${audience.length - 4}` : ''}`.slice(0, 120);
}

/**
 * Guarda a live como aula normal do YouTube no banco de aulas, numa pasta só daquele público
 * (ex.: "Lives · Turma Medicina"), com os PDFs da live. Depois dá para pôr a aula em qualquer curso.
 */
async function archiveAsLesson(id: string): Promise<ActionResult> {
  const live = await sql.one<{ title: string; description: string; youtube_id: string; cover_url: string; audience: string[]; materials: LessonMaterial[]; lesson_id: string | null }>(
    `select title, description, youtube_id, cover_url, audience, materials, lesson_id from live_sessions where id = $1`,
    [id],
  );
  if (!live) return { error: 'Transmissão não encontrada.' };
  if (!live.youtube_id) return { error: 'A live não tem link do YouTube.' };
  const existing = live.lesson_id
    ? await sql.one<{ id: string }>(`select id from lessons where id = $1`, [live.lesson_id])
    : // gravação já salva antes (pasta de lives), sem repetir
      await sql.one<{ id: string }>(
        `select l.id from lessons l join lesson_folders f on f.id = l.folder_id where l.youtube_id = $1 and lower(f.name) like 'lives%' limit 1`,
        [live.youtube_id],
      );
  if (existing) {
    await sql.exec(`update live_sessions set lesson_id = $2 where id = $1`, [id, existing.id]);
    await syncLessonMaterials(id);
    return { ok: true };
  }
  const name = await folderName(live.audience ?? []);
  let folder = await sql.one<{ id: string }>(`select id from lesson_folders where lower(name) = lower($1) limit 1`, [name]);
  if (!folder) {
    folder = { id: newId() };
    await sql.exec(`insert into lesson_folders (id, name, position) select $1, $2, coalesce(max(position), -1) + 1 from lesson_folders`, [folder.id, name]);
  }
  const lessonId = newId();
  const mats = live.materials ?? [];
  await sql.exec(
    `insert into lessons (id, title, description, youtube_id, thumbnail_url, is_published, folder_id, materials, material_paths, position)
     select $1, $2, $3, $4, $5, true, $6, $7, $8, coalesce(max(position), -1) + 1 from lessons where folder_id = $6`,
    [lessonId, live.title, live.description, live.youtube_id, live.cover_url, folder.id, JSON.stringify(mats), mats.map((m) => m.file_path)],
  );
  await sql.exec(`update live_sessions set lesson_id = $2 where id = $1`, [id, lessonId]);
  refreshCatalog();
  revalidatePath('/admin/aulas');
  return { ok: true };
}

/** Os PDFs da live também ficam na aula salva (sem apagar os que o mentor pôs direto na aula). */
async function syncLessonMaterials(liveId: string, removedPath?: string) {
  const live = await sql.one<{ lesson_id: string | null; materials: LessonMaterial[] }>(`select lesson_id, materials from live_sessions where id = $1`, [liveId]);
  if (!live?.lesson_id) return;
  const lesson = await sql.one<{ materials: LessonMaterial[] }>(`select materials from lessons where id = $1`, [live.lesson_id]);
  if (!lesson) return;
  const paths = new Set((lesson.materials ?? []).map((m) => m.file_path));
  const merged = [...(lesson.materials ?? []).filter((m) => m.file_path !== removedPath), ...(live.materials ?? []).filter((m) => !paths.has(m.file_path))];
  await sql.exec(`update lessons set materials = $2, material_paths = $3, updated_at = now() where id = $1`, [live.lesson_id, JSON.stringify(merged), merged.map((m) => m.file_path)]);
  refreshCatalog();
}

/** PDFs da live: o professor sobe durante a transmissão ou depois; os alunos veem na sala e na aula salva. */
export async function addLiveMaterials(liveId: string, files: { title: string; path: string; size: string }[]): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(liveId)) return { error: 'Inválido.' };
    const add = (files ?? [])
      .filter((f) => typeof f.path === 'string' && /^lives\/[\w/-]+\.pdf$/.test(f.path))
      .slice(0, 30)
      .map((f) => ({ id: newId(), title: String(f.title || 'Material').slice(0, 160), file_path: f.path, size_label: String(f.size ?? '').slice(0, 20) }));
    if (!add.length) return { error: 'Envie um PDF.' };
    const n = await sql.exec(
      `update live_sessions set materials = materials || $2::jsonb, material_paths = material_paths || $3::text[], updated_at = now() where id = $1`,
      [liveId, JSON.stringify(add), add.map((f) => f.file_path)],
    );
    if (!n) return { error: 'Transmissão não encontrada.' };
    await syncLessonMaterials(liveId);
    refresh(liveId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeLiveMaterial(liveId: string, fileId: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(liveId)) return { error: 'Inválido.' };
    const live = await sql.one<{ materials: LessonMaterial[] }>(`select materials from live_sessions where id = $1`, [liveId]);
    if (!live) return { error: 'Transmissão não encontrada.' };
    const gone = (live.materials ?? []).find((m) => m.id === fileId);
    const rest = (live.materials ?? []).filter((m) => m.id !== fileId);
    await sql.exec(`update live_sessions set materials = $2, material_paths = $3, updated_at = now() where id = $1`, [liveId, JSON.stringify(rest), rest.map((m) => m.file_path)]);
    if (gone) await syncLessonMaterials(liveId, gone.file_path);
    refresh(liveId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveLiveAsLesson(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    return await archiveAsLesson(id);
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Estúdio: transmitir direto do app para o YouTube

export async function disconnectYoutube(): Promise<ActionResult> {
  try {
    await requireAdminAction();
    await saveAccount({ refresh_token: '', access_token: '', expires_at: undefined, channel_id: '', channel_title: '' });
    revalidatePath('/admin/ao-vivo');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Prepara a live no YouTube (cria no canal ou usa a chave) e coloca a sala no ar. */
export async function startStudio(id: string): Promise<ActionResult & { videoId?: string }> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const live = await sql.one<{ title: string; description: string; youtube_id: string }>(`select title, description, youtube_id from live_sessions where id = $1`, [id]);
    if (!live) return { error: 'Transmissão não encontrada.' };
    const acc = await getAccount();
    let videoId = live.youtube_id;
    if (oauthConfigured() && acc.refresh_token) {
      const b = await createBroadcast(live.title, live.description);
      videoId = b.videoId;
      await setIngest(id, b.ingest);
    } else {
      return { error: 'Conecte a conta do YouTube em Ao vivo.' };
    }
    await sql.exec(`update live_sessions set youtube_id = $2, status = 'live', updated_at = now() where id = $1`, [id, videoId]);
    refresh(id);
    return { ok: true, videoId };
  } catch (e) {
    return { error: e instanceof Error && !e.message.includes('Acesso') ? e.message : 'Não foi possível iniciar.' };
  }
}

export async function stopStudio(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const live = await sql.one<{ youtube_id: string }>(`update live_sessions set status = 'ended', updated_at = now() where id = $1 returning youtube_id`, [id]);
    await sql.exec(`delete from integrations where id = $1`, [`ingest:${id}`]);
    const acc = await getAccount();
    if (live?.youtube_id && oauthConfigured() && acc.refresh_token) await endBroadcast(live.youtube_id);
    await archiveAsLesson(id).catch(() => {});
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
