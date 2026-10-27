'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireViewer } from '@/lib/session';

export async function updateProfile(_: unknown, form: FormData) {
  const viewer = await requireViewer();
  const full_name = String(form.get('full_name') ?? '').trim().slice(0, 120);
  const phone = String(form.get('phone') ?? '').replace(/[^\d+()\s-]/g, '').slice(0, 30);
  const birth = String(form.get('birth_date') ?? '');
  if (full_name.length < 2) return { error: 'Informe seu nome completo.' };
  try {
    await db()
      .doc(`users/${viewer.userId}`)
      .set({ full_name, phone, birth_date: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null }, { merge: true });
  } catch {
    return { error: 'Não foi possível salvar.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
