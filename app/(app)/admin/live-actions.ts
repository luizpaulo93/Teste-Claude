'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { bool, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { newId, sql } from '@/lib/db';
import { extractYoutubeId, isDocId } from '@/lib/utils';
import type { LessonMaterial } from '@/lib/types';
import { claimLease, endStudio, HOLDER_STALE_MS, patchScene, studioRow, type StudioResume, type StudioScene } from '@/lib/live-studio';
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
    if (!title) return { error: 'Dê um nome à transmissão.' };
    let newLive = '';
    // PDFs escolhidos no formulário (os alunos baixam durante a live)
    let mats: LessonMaterial[] = [];
    try {
      const raw = JSON.parse(String(fd.get('materials') ?? '[]')) as LessonMaterial[];
      mats = (Array.isArray(raw) ? raw : [])
        .filter((m) => typeof m?.file_path === 'string' && /^lives\/[\w/-]+\.pdf$/.test(m.file_path))
        .slice(0, 30)
        .map((m) => ({
          id: String(m.id || newId()).slice(0, 40),
          title: String(m.title || 'Material').slice(0, 160),
          file_path: m.file_path,
          size_label: String(m.size_label ?? '').slice(0, 20),
        }));
    } catch {
      /* sem PDFs */
    }
    const values = [
      title,
      str(fd, 'description', 2000),
      // o link do YouTube não é mais digitado: o Estúdio cria a live no canal (fica o que já existia)
      fd.has('youtube') ? extractYoutubeId(str(fd, 'youtube', 300)) : null,
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
        `update live_sessions set title = $2, description = $3, youtube_id = coalesce($4, youtube_id), cover_url = $5, course_id = $6, starts_at = $7,
           show_replay = $8, chat_enabled = $9, is_published = $10, space = $11, audience = $12, updated_at = now() where id = $1`,
        [id, ...values, space, audience],
      );
      if (fd.has('materials')) {
        const old = await sql.one<{ materials: LessonMaterial[] }>(`select materials from live_sessions where id = $1`, [id]);
        await sql.exec(`update live_sessions set materials = $2, material_paths = $3 where id = $1`, [id, JSON.stringify(mats), mats.map((m) => m.file_path)]);
        const keep = new Set(mats.map((m) => m.file_path));
        for (const gone of (old?.materials ?? []).filter((m) => !keep.has(m.file_path))) await syncLessonMaterials(id, gone.file_path);
        await syncLessonMaterials(id);
      }
    } else {
      newLive = newId();
      await sql.exec(
        `insert into live_sessions (id, title, description, youtube_id, cover_url, course_id, starts_at, show_replay, chat_enabled, is_published, space, audience, materials, material_paths)
         values ($1, $2, $3, coalesce($4, ''), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [newLive, ...values, space, audience, JSON.stringify(mats), mats.map((m) => m.file_path)],
      );
    }
    refresh(id || undefined);
    return { ok: true, id: id || newLive };
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

const LIVE_FOLDER = 'Live';

/** "31/10/2026 às 23:14" no horário de Brasília. */
function liveWhen(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d);
  return { date, label: `${date} às ${time}` };
}

/**
 * Curso "Live" da turma: criado sozinho na primeira live da turma (com o módulo "Aulas ao vivo")
 * e liberado para ela. Devolve o módulo onde as gravações entram.
 */
async function liveModuleFor(classId: string) {
  const cls = await sql.one<{ name: string; course_ids: string[] }>(`select name, course_ids from classes where id = $1`, [classId]);
  if (!cls) return null;
  let course = await sql.one<{ id: string }>(`select id from courses where live_class_id = $1`, [classId]);
  if (!course) {
    course = { id: newId() };
    await sql.exec(
      `insert into courses (id, title, subtitle, description, cover_url, is_published, position, live_class_id)
       select $1, 'Live', $2, 'Gravações das aulas ao vivo da turma, da mais antiga para a mais recente.', 'color:3', true, coalesce(max(position), -1) + 1, $3 from courses
       on conflict do nothing`,
      [course.id, cls.name, classId],
    );
    course = (await sql.one<{ id: string }>(`select id from courses where live_class_id = $1`, [classId])) ?? course;
  }
  if (!(cls.course_ids ?? []).includes(course.id))
    await sql.exec(`update classes set course_ids = array_append(course_ids, $2), updated_at = now() where id = $1`, [classId, course.id]);
  let mod = await sql.one<{ id: string }>(`select id from modules where course_id = $1 order by position limit 1`, [course.id]);
  if (!mod) {
    mod = { id: newId() };
    await sql.exec(`insert into modules (id, course_id, title, position, is_published) values ($1, $2, 'Aulas ao vivo', 0, true)`, [mod.id, course.id]);
  }
  return mod.id;
}

/** Coloca a gravação no curso "Live" de cada turma do público, em ordem de data (mais antiga no topo). */
async function placeInClassCourses(lessonId: string, audience: string[]) {
  for (const t of audience.filter((x) => x.startsWith('c:'))) {
    const mod = await liveModuleFor(t.slice(2));
    if (!mod) continue;
    await sql.exec(`insert into module_lessons (module_id, lesson_id, position) values ($1, $2, 0) on conflict do nothing`, [mod, lessonId]);
    await sql.exec(
      `update module_lessons ml set position = r.rn
         from (select ml2.lesson_id, (row_number() over (order by coalesce(s.starts_at, l.created_at)) - 1)::int as rn
                 from module_lessons ml2 join lessons l on l.id = ml2.lesson_id
                 left join live_sessions s on s.lesson_id = l.id
                where ml2.module_id = $1) r
        where ml.module_id = $1 and ml.lesson_id = r.lesson_id`,
      [mod],
    );
  }
}

/**
 * Guarda a live como aula normal do YouTube na pasta "Live" do banco de aulas, com o nome, a data e os
 * PDFs da live, e coloca no curso "Live" de cada turma que recebeu a live.
 */
async function archiveAsLesson(id: string): Promise<ActionResult> {
  const live = await sql.one<{
    title: string;
    description: string;
    youtube_id: string;
    cover_url: string;
    audience: string[];
    materials: LessonMaterial[];
    lesson_id: string | null;
    starts_at: string;
  }>(`select title, description, youtube_id, cover_url, audience, materials, lesson_id, starts_at from live_sessions where id = $1`, [id]);
  if (!live) return { error: 'Transmissão não encontrada.' };
  if (!live.youtube_id) return { error: 'A live não tem link do YouTube.' };
  const existing = live.lesson_id
    ? await sql.one<{ id: string }>(`select id from lessons where id = $1`, [live.lesson_id])
    : // gravação já salva antes (pasta de lives), sem repetir
      await sql.one<{ id: string }>(
        `select l.id from lessons l join lesson_folders f on f.id = l.folder_id where l.youtube_id = $1 and lower(f.name) like 'live%' limit 1`,
        [live.youtube_id],
      );
  if (existing) {
    await sql.exec(`update live_sessions set lesson_id = $2 where id = $1`, [id, existing.id]);
    await syncLessonMaterials(id);
    await placeInClassCourses(existing.id, live.audience ?? []);
    refreshCatalog();
    return { ok: true };
  }
  // Uma pasta só para as lives (a antiga "Lives" vira "Live")
  let folder = await sql.one<{ id: string }>(
    `select id from lesson_folders where lower(name) in ('live', 'lives') order by (lower(name) = 'live') desc limit 1`,
  );
  if (folder) await sql.exec(`update lesson_folders set name = $2 where id = $1 and name <> $2`, [folder.id, LIVE_FOLDER]);
  if (!folder) {
    folder = { id: newId() };
    await sql.exec(`insert into lesson_folders (id, name, position) select $1, $2, coalesce(max(position), -1) + 1 from lesson_folders`, [
      folder.id,
      LIVE_FOLDER,
    ]);
  }
  const lessonId = newId();
  const mats = live.materials ?? [];
  const when = liveWhen(live.starts_at);
  const description = [`Aula ao vivo de ${when.label}.`, live.description].filter(Boolean).join('\n\n');
  await sql.exec(
    `insert into lessons (id, title, description, youtube_id, thumbnail_url, is_published, folder_id, materials, material_paths, position)
     select $1, $2, $3, $4, $5, true, $6, $7, $8, coalesce(max(position), -1) + 1 from lessons where folder_id = $6`,
    [
      lessonId,
      `${live.title} · ${when.date}`.slice(0, 160),
      description,
      live.youtube_id,
      live.cover_url,
      folder.id,
      JSON.stringify(mats),
      mats.map((m) => m.file_path),
    ],
  );
  await sql.exec(`update live_sessions set lesson_id = $2 where id = $1`, [id, lessonId]);
  await placeInClassCourses(lessonId, live.audience ?? []);
  refreshCatalog();
  revalidatePath('/admin/aulas');
  revalidatePath('/admin/cursos');
  return { ok: true };
}

/** Os PDFs da live também ficam na aula salva (sem apagar os que o mentor pôs direto na aula). */
async function syncLessonMaterials(liveId: string, removedPath?: string) {
  const live = await sql.one<{ lesson_id: string | null; materials: LessonMaterial[] }>(`select lesson_id, materials from live_sessions where id = $1`, [
    liveId,
  ]);
  if (!live?.lesson_id) return;
  const lesson = await sql.one<{ materials: LessonMaterial[] }>(`select materials from lessons where id = $1`, [live.lesson_id]);
  if (!lesson) return;
  const paths = new Set((lesson.materials ?? []).map((m) => m.file_path));
  const merged = [...(lesson.materials ?? []).filter((m) => m.file_path !== removedPath), ...(live.materials ?? []).filter((m) => !paths.has(m.file_path))];
  await sql.exec(`update lessons set materials = $2, material_paths = $3, updated_at = now() where id = $1`, [
    live.lesson_id,
    JSON.stringify(merged),
    merged.map((m) => m.file_path),
  ]);
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
    await sql.exec(`update live_sessions set materials = $2, material_paths = $3, updated_at = now() where id = $1`, [
      liveId,
      JSON.stringify(rest),
      rest.map((m) => m.file_path),
    ]);
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
export async function startStudio(
  id: string,
  device?: { id: string; label: string },
): Promise<ActionResult & { videoId?: string; lease?: string }> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const live = await sql.one<{ title: string; description: string; youtube_id: string }>(
      `select title, description, youtube_id from live_sessions where id = $1`,
      [id],
    );
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
    // este aparelho transmite (live nova: a playlist começa do zero)
    const lease = device ? (await claimLease(id, device.id, device.label, true)).lease : undefined;
    refresh(id);
    return { ok: true, videoId, lease };
  } catch (e) {
    return { error: e instanceof Error && !e.message.includes('Acesso') ? e.message : 'Não foi possível iniciar.' };
  }
}

export async function stopStudio(id: string): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const live = await sql.one<{ youtube_id: string }>(`update live_sessions set status = 'ended', updated_at = now() where id = $1 returning youtube_id`, [
      id,
    ]);
    await sql.exec(`delete from integrations where id = $1`, [`ingest:${id}`]);
    await endStudio(id).catch(() => {});
    const acc = await getAccount();
    if (live?.youtube_id && oauthConfigured() && acc.refresh_token) await endBroadcast(live.youtube_id);
    await archiveAsLesson(id).catch(() => {});
    refresh(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Tela da aula de live (Admin → Aulas): o mentor muda o nome e os PDFs. O link do YouTube fica travado.
 * Os PDFs valem na aula salva e na sala da live.
 */
export async function saveLiveLesson(lessonId: string, data: { title: string; materials: LessonMaterial[] }): Promise<ActionResult> {
  try {
    await requireAdminAction();
    if (!isDocId(lessonId)) return { error: 'Inválido.' };
    const title = String(data.title ?? '')
      .trim()
      .slice(0, 160);
    if (!title) return { error: 'Dê um nome à aula.' };
    const mats = (Array.isArray(data.materials) ? data.materials : [])
      .filter((m) => typeof m?.file_path === 'string' && /^(lives|lessons|mentoria)\/[\w/-]+\.pdf$/.test(m.file_path))
      .slice(0, 40)
      .map((m) => ({
        id: String(m.id || newId()).slice(0, 40),
        title: String(m.title || 'Material').slice(0, 160),
        file_path: m.file_path,
        size_label: String(m.size_label ?? '').slice(0, 20),
      }));
    const n = await sql.exec(`update lessons set title = $2, materials = $3, material_paths = $4, updated_at = now() where id = $1`, [
      lessonId,
      title,
      JSON.stringify(mats),
      mats.map((m) => m.file_path),
    ]);
    if (!n) return { error: 'Aula não encontrada.' };
    // a sala da live mostra os mesmos PDFs
    const lives = await sql.query<{ id: string }>(`update live_sessions set materials = $2, material_paths = $3 where lesson_id = $1 returning id`, [
      lessonId,
      JSON.stringify(mats),
      mats.map((m) => m.file_path),
    ]);
    lives.forEach((l) => updateTag(`live-${l.id}`));
    refreshCatalog();
    revalidatePath('/admin/aulas', 'layout');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- estúdio em vários aparelhos

/**
 * Este aparelho assume a live que já está no ar (outro aparelho transmitia): mesma transmissão do YouTube,
 * a playlist continua de onde parou e o aparelho anterior para sozinho.
 */
export async function claimStudio(
  id: string,
  device: { id: string; label: string },
): Promise<ActionResult & { lease?: string; resume?: StudioResume | null; notLive?: boolean }> {
  try {
    await requireAdminAction();
    if (!isDocId(id)) return { error: 'Inválido.' };
    const live = await sql.one<{ status: string }>(`select status from live_sessions where id = $1`, [id]);
    if (!live) return { error: 'Transmissão não encontrada.' };
    if (live.status !== 'live') return { notLive: true };
    const ingest = await sql.one(`select 1 from integrations where id = $1`, [`ingest:${id}`]);
    if (!ingest) return { notLive: true };
    const r = await claimLease(id, String(device.id), String(device.label), false);
    return { ok: true, lease: r.lease, resume: r.resume };
  } catch (e) {
    return fail(e);
  }
}

/** Situação do estúdio para cada aparelho: a live está no ar? quem transmite? qual a cena? */
export async function pollStudio(id: string) {
  await requireAdminAction();
  if (!isDocId(id)) return null;
  const [live, row] = await Promise.all([
    sql.one<{ status: string; materials: LessonMaterial[] | null }>(`select status, materials from live_sessions where id = $1`, [id]),
    studioRow(id),
  ]);
  if (!live) return null;
  const at = row?.lease_at ? new Date(row.lease_at).getTime() : 0;
  return {
    status: live.status as 'scheduled' | 'live' | 'ended',
    holder: row?.lease ? { device: row.device, label: row.label, fresh: Date.now() - at < HOLDER_STALE_MS } : null,
    state: row?.state ?? {},
    rev: row?.rev ?? 0,
    res: row?.resume?.res ?? row?.state?.res,
    materials: (live.materials ?? []).map((m) => m.id),
    now: Date.now(),
  };
}

/** Troca a cena em todos os aparelhos (câmera ou PDF, qual PDF e página, câmera no canto, microfone). */
export async function setStudioScene(id: string, patch: StudioScene) {
  await requireAdminAction();
  if (!isDocId(id)) return null;
  const clean: StudioScene = {};
  if (patch.scene && ['camera', 'pdf', 'both', 'screen'].includes(patch.scene)) clean.scene = patch.scene;
  if (typeof patch.pdfId === 'string' && patch.pdfId.length < 80) clean.pdfId = patch.pdfId;
  if (typeof patch.page === 'number' && patch.page > 0 && patch.page < 10000) clean.page = Math.round(patch.page);
  if (typeof patch.pip === 'boolean') clean.pip = patch.pip;
  if (typeof patch.muted === 'boolean') clean.muted = patch.muted;
  if (patch.res === '1080' || patch.res === '720') clean.res = patch.res;
  return patchScene(id, clean);
}
