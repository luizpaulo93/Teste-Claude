'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { bool, fail, refreshCatalog, requireAdminAction, str, type ActionResult } from '@/lib/admin/guard';
import { newId, sql } from '@/lib/db';
import { extractYoutubeId, isDocId } from '@/lib/utils';
import type { LessonMaterial } from '@/lib/types';
import { PACKED_RE, type PackedOps, type PackedStroke } from '@/lib/live/ink';
import { claimLease, endStudio, setStageDevice, HOLDER_STALE_MS, patchScene, studioRow, type StudioResume, type StudioScene } from '@/lib/live-studio';
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
export interface StudioDevice {
  device: string;
  label: string;
  cams: { id: string; name: string }[];
  mics: { id: string; name: string }[];
  cam: string;
  mic: string;
}
type StudioCmd = { t: 'cam' | 'mic' | 'take' | 'scan' | 'start' | 'feed' | 'usecam'; id?: string };

export async function pollStudio(
  id: string,
  device = '',
  report?: Omit<StudioDevice, 'device'>,
  /** reserva do espelho: needPreview = este aparelho não recebe a imagem direta; preview = foto do aparelho principal */
  extra?: { needPreview?: boolean; preview?: string },
) {
  await requireAdminAction();
  if (!isDocId(id)) return null;
  const dev = device.slice(0, 64);
  if (dev && extra?.needPreview) await sql.exec(`update live_devices set want_preview = now() where live_id = $1 and device = $2`, [id, dev]);
  if (dev && extra?.preview && extra.preview.length < 200_000 && extra.preview.startsWith('data:image/jpeg;base64,'))
    await sql.exec(`update live_studio set preview = $3, preview_at = now() where live_id = $1 and device = $2`, [id, dev, extra.preview]);
  // este aparelho está no estúdio (e o que ele tem); pega o comando que outro aparelho deixou para ele
  let cmd: StudioCmd | null = null;
  if (dev) {
    const clean = (l: unknown) =>
      (Array.isArray(l) ? l : []).slice(0, 12).map((x: { id?: unknown; name?: unknown }) => ({ id: String(x?.id ?? '').slice(0, 200), name: String(x?.name ?? '').slice(0, 80) }));
    const r = report
      ? await sql.one<{ cmd: StudioCmd | null }>(
          `insert into live_devices (live_id, device, label, cams, mics, cam, mic, seen_at) values ($1, $2, $3, $4, $5, $6, $7, now())
           on conflict (live_id, device) do update set label = excluded.label, cams = excluded.cams, mics = excluded.mics, cam = excluded.cam,
             mic = excluded.mic, seen_at = now()
           returning cmd`,
          [id, dev, String(report.label).slice(0, 40), JSON.stringify(clean(report.cams)), JSON.stringify(clean(report.mics)), String(report.cam).slice(0, 200), String(report.mic).slice(0, 200)],
        )
      : await sql.one<{ cmd: StudioCmd | null }>(
          `insert into live_devices (live_id, device, seen_at) values ($1, $2, now())
           on conflict (live_id, device) do update set seen_at = now()
           returning cmd`,
          [id, dev],
        );
    cmd = r?.cmd ?? null;
    if (cmd) await sql.exec(`update live_devices set cmd = null where live_id = $1 and device = $2`, [id, dev]);
  }
  const [live, row, signals, devices, pv] = await Promise.all([
    sql.one<{ status: string; materials: LessonMaterial[] | null }>(`select status, materials from live_sessions where id = $1`, [id]),
    studioRow(id),
    // combinação da ligação direta com outro aparelho (entregue uma vez só)
    device
      ? sql.query<{ from: string; kind: 'offer' | 'answer'; sdp: string }>(
          `delete from live_rtc where live_id = $1 and (to_device = $2 or created_at < now() - interval '2 minutes') returning from_device as "from", kind, sdp, to_device`,
          [id, device.slice(0, 64)],
        )
      : Promise.resolve([]),
    sql.query<StudioDevice>(
      `select device, label, cams, mics, cam, mic from live_devices where live_id = $1 and seen_at > now() - interval '8 seconds' order by label, device`,
      [id],
    ),
    sql.one<{ wanted: boolean; preview: string | null }>(
      `select exists (select 1 from live_devices where live_id = $1 and want_preview > now() - interval '5 seconds') as wanted,
              (select case when $2 and preview_at > now() - interval '6 seconds' then preview end from live_studio where live_id = $1) as preview`,
      [id, Boolean(extra?.needPreview)],
    ),
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
    signals: (signals as { from: string; kind: 'offer' | 'answer'; sdp: string; to_device?: string }[])
      .filter((x) => x.to_device === device)
      .map(({ from, kind, sdp }) => ({ from, kind, sdp })),
    devices,
    cmd,
    // aparelho principal: o da câmera em uso (durante a live, o que transmite); só vale se está com o estúdio aberto
    // o aparelho principal manda a foto enquanto alguém precisar; quem precisa recebe a última
    previewWanted: Boolean(pv?.wanted),
    inkRev: row?.ink_rev ?? 0,
    preview: pv?.preview ?? null,
    stage: row?.device ? { device: row.device, label: row.label, present: devices.some((d) => d.device === row.device) } : null,
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
  if (typeof patch.mirror === 'boolean') clean.mirror = patch.mirror;
  if (typeof patch.pipAspect === 'number' && patch.pipAspect > 0.2 && patch.pipAspect < 5) clean.pipAspect = patch.pipAspect;
  const v = patch.pdfPos;
  if (v && [v.cx, v.cy, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000)) clean.pdfPos = { cx: v.cx, cy: v.cy, zoom: v.zoom };
  const b = patch.pipBox;
  if (b && [b.x, b.y, b.w].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 2)) clean.pipBox = { x: b.x, y: b.y, w: b.w };
  return patchScene(id, clean);
}

/** Combinação da ligação direta entre dois aparelhos do estúdio (oferta ou resposta). */
export async function rtcSend(id: string, from: string, to: string, kind: 'offer' | 'answer', sdp: string) {
  await requireAdminAction();
  if (!isDocId(id) || !['offer', 'answer'].includes(kind) || typeof sdp !== 'string' || sdp.length > 30_000) return { error: 'Inválido.' };
  // uma oferta nova substitui a anterior para o mesmo aparelho
  await sql.exec(`delete from live_rtc where live_id = $1 and to_device = $2 and from_device = $3`, [id, String(to).slice(0, 64), String(from).slice(0, 64)]);
  await sql.exec(`insert into live_rtc (live_id, to_device, from_device, kind, sdp) values ($1, $2, $3, $4, $5)`, [
    id,
    String(to).slice(0, 64),
    String(from).slice(0, 64),
    kind,
    sdp,
  ]);
  return { ok: true };
}

/** Comando para outro aparelho do estúdio: trocar câmera/microfone de quem transmite ou assumir a live com uma câmera. */
export async function studioCommand(id: string, device: string, cmd: StudioCmd) {
  await requireAdminAction();
  if (!isDocId(id) || !['cam', 'mic', 'take', 'scan', 'start', 'feed', 'usecam'].includes(cmd?.t)) return { error: 'Inválido.' };
  await sql.exec(`update live_devices set cmd = $3 where live_id = $1 and device = $2`, [
    id,
    String(device).slice(0, 64),
    JSON.stringify({ t: cmd.t, id: cmd.id ? String(cmd.id).slice(0, 200) : undefined }),
  ]);
  return { ok: true };
}

/** "Atualizar": todos os aparelhos abertos no estúdio leem as câmeras e microfones de novo. */
export async function studioScan(id: string) {
  await requireAdminAction();
  if (!isDocId(id)) return { error: 'Inválido.' };
  await sql.exec(`update live_devices set cmd = '{"t":"scan"}'::jsonb where live_id = $1 and seen_at > now() - interval '8 seconds' and cmd is null`, [id]);
  return { ok: true };
}

/** Este aparelho passa a ser o principal do estúdio (a câmera dele é a da live), antes de a live começar. */
export async function setStage(id: string, device: { id: string; label: string }) {
  await requireAdminAction();
  if (!isDocId(id)) return { error: 'Inválido.' };
  await setStageDevice(id, String(device.id), String(device.label));
  return { ok: true };
}

// ---------------------------------------------------------------- escrita por cima do PDF
/** traço compacto vindo do estúdio: confere tudo antes de guardar */
const cleanStroke = (x: PackedStroke): PackedStroke | null => {
  if (!x || typeof x.id !== 'string' || !x.id || typeof x.d !== 'string' || !x.d || x.d.length > 24000 || !PACKED_RE.test(x.d)) return null;
  const s: PackedStroke = {
    id: x.id.slice(0, 24),
    tool: x.tool === 'marker' ? 'marker' : 'pen',
    color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '#111111',
    size: Math.min(0.2, Math.max(0.00005, Number(x.size) || 0.004)),
    d: x.d,
  };
  if (typeof x.p === 'string' && x.p.length <= 12000 && PACKED_RE.test(x.p)) s.p = x.p;
  if (x.s === 1 || x.s === 2) s.s = x.s;
  return s;
};
/** até quantos traços por PDF */
const INK_MAX = 20000;

/** Traços do PDF (para quem abriu o estúdio ou trocou de PDF). */
export async function getInk(id: string, pdfId: string) {
  await requireAdminAction();
  if (!isDocId(id)) return { strokes: [] as PackedStroke[] };
  const rows = await sql.query<{ data: string }>(`select data from live_ink where live_id = $1 and pdf_id = $2 order by n limit ${INK_MAX}`, [
    id,
    String(pdfId).slice(0, 80),
  ]);
  const strokes: PackedStroke[] = [];
  for (const r of rows)
    try {
      strokes.push(JSON.parse(r.data) as PackedStroke);
    } catch {}
  return { strokes };
}

/** Mudanças na escrita (traços novos, apagados, movidos): grava só os traços que mudaram. */
export async function inkOps(id: string, pdfId: string, ops: PackedOps) {
  await requireAdminAction();
  if (!isDocId(id) || typeof pdfId !== 'string' || !pdfId) return { error: 'Inválido.' };
  const pid = pdfId.slice(0, 80);
  const add = (Array.isArray(ops?.add) ? ops.add : []).slice(0, 500).map(cleanStroke).filter((x): x is PackedStroke => Boolean(x));
  const remove = [...new Set((Array.isArray(ops?.remove) ? ops.remove : []).slice(0, 5000).map((x) => String(x).slice(0, 24)))];
  if (remove.length) await sql.exec(`delete from live_ink where live_id = $1 and pdf_id = $2 and id = any($3)`, [id, pid, remove]);
  if (add.length) {
    const cnt = await sql.one<{ n: number }>(`select count(*)::int n from live_ink where live_id = $1 and pdf_id = $2`, [id, pid]);
    if ((cnt?.n ?? 0) + add.length <= INK_MAX)
      await sql.exec(
        `insert into live_ink (live_id, pdf_id, id, data) select $1, $2, x.id, x.data from unnest($3::text[], $4::text[]) as x(id, data)
         on conflict (live_id, pdf_id, id) do update set data = excluded.data`,
        [id, pid, add.map((x) => x.id), add.map((x) => JSON.stringify(x))],
      );
  }
  // número da versão da escrita na live (os outros aparelhos buscam de novo quando muda)
  const r = await sql.one<{ ink_rev: number }>(
    `insert into live_studio (live_id, ink_rev) values ($1, 1) on conflict (live_id) do update set ink_rev = live_studio.ink_rev + 1 returning ink_rev`,
    [id],
  );
  return { ok: true, rev: r?.ink_rev ?? 0 };
}

// ---------------- preferências da escrita (tamanhos, cor, forma): seguem o professor de uma live para outra
export type InkPrefs = { sizes?: Record<string, number>; color?: string; shape?: string; dash?: boolean };
const cleanPrefs = (v: unknown): InkPrefs => {
  const p = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out: InkPrefs = {};
  if (p.sizes && typeof p.sizes === 'object')
    out.sizes = Object.fromEntries(
      Object.entries(p.sizes as Record<string, unknown>)
        .filter(([k, n]) => ['pen', 'marker', 'eraser', 'laser', 'shape'].includes(k) && typeof n === 'number' && n >= 0.1 && n <= 7)
        .map(([k, n]) => [k, Math.round((n as number) * 10) / 10]),
    );
  if (typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color)) out.color = p.color;
  if (typeof p.shape === 'string' && /^[a-z]{1,12}$/.test(p.shape)) out.shape = p.shape;
  if (typeof p.dash === 'boolean') out.dash = p.dash;
  return out;
};
export async function getInkPrefs(): Promise<InkPrefs | null> {
  const v = await requireAdminAction();
  const row = await sql.one<{ data: unknown }>(`select data from settings where id = $1`, [`ink:${v.userId}`]);
  return row ? cleanPrefs(row.data) : null;
}
export async function saveInkPrefs(prefs: InkPrefs) {
  const v = await requireAdminAction();
  await sql.exec(
    `insert into settings (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [`ink:${v.userId}`, JSON.stringify(cleanPrefs(prefs))],
  );
  return { ok: true };
}
