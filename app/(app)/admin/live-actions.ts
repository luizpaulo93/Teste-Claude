'use server';

import { revalidatePath } from 'next/cache';
import { adminClient, bool, fail, str, type ActionResult } from '@/lib/admin/guard';
import { extractYoutubeId } from '@/lib/utils';

function refresh() {
  revalidatePath('/admin/ao-vivo');
  revalidatePath('/', 'layout');
}

export async function saveLive(fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const id = str(fd, 'id', 64);
    const startsLocal = str(fd, 'starts_at', 20);
    const tz = str(fd, 'tz_offset', 6);
    const starts = new Date(`${startsLocal}:00${/^[+-]\d{2}:\d{2}$/.test(tz) ? tz : '-03:00'}`);
    if (Number.isNaN(starts.getTime())) return { error: 'Data/hora inválida.' };
    const courseId = str(fd, 'course_id', 64);
    const row = {
      title: str(fd, 'title', 160),
      description: str(fd, 'description', 2000),
      youtube_id: extractYoutubeId(str(fd, 'youtube', 300)),
      cover_url: str(fd, 'cover_url', 2000),
      course_id: /^[0-9a-f-]{36}$/i.test(courseId) ? courseId : null,
      starts_at: starts.toISOString(),
      show_replay: bool(fd, 'show_replay'),
      chat_enabled: bool(fd, 'chat_enabled'),
      is_published: bool(fd, 'is_published'),
      updated_at: new Date().toISOString(),
    };
    if (!row.title) return { error: 'Informe o título.' };
    const { error } = id ? await supabase.from('live_sessions').update(row).eq('id', id) : await supabase.from('live_sessions').insert(row);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setLiveStatus(id: string, status: 'scheduled' | 'live' | 'ended'): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    if (status === 'live') {
      const { data } = await supabase.from('live_sessions').select('youtube_id').eq('id', id).maybeSingle();
      if (!data?.youtube_id) return { error: 'Cole o link da transmissão do YouTube antes de iniciar.' };
    }
    const { error } = await supabase.from('live_sessions').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLive(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await adminClient();
    const { error } = await supabase.from('live_sessions').delete().eq('id', id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, 'Não foi possível excluir.');
  }
}
