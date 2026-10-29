'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { requireViewer } from '@/lib/session';

export async function updateProfile(_: unknown, form: FormData) {
  const viewer = await requireViewer();
  const full_name = String(form.get('full_name') ?? '').trim().slice(0, 120);
  const phone = String(form.get('phone') ?? '').replace(/[^\d+()\s-]/g, '').slice(0, 30);
  const birth = String(form.get('birth_date') ?? '');
  if (full_name.length < 2) return { error: 'Informe seu nome completo.' };
  try {
    await sql.exec(
      `insert into users (id, email, full_name, phone, birth_date, role) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, birth_date = excluded.birth_date`,
      [viewer.userId, viewer.email, full_name, phone, /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null, viewer.profile.role],
    );
  } catch {
    return { error: 'Não foi possível salvar.' };
  }
  updateTag(`viewer-${viewer.userId}`);
  revalidatePath('/', 'layout');
  return { ok: true };
}
