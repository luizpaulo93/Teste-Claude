import 'server-only';
import { updateTag } from 'next/cache';
import { getViewer } from '@/lib/session';

export type ActionResult = { ok?: true; error?: string; id?: string };

/** Garante que só admin executa a ação (todas as gravações do painel passam por aqui). */
export async function requireAdminAction() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) throw new Error('Acesso negado');
  return viewer;
}

/** Renova o cache do catálogo/configurações para todos verem a mudança na hora. */
export function refreshCatalog() {
  updateTag('catalog');
}
export function refreshSettings() {
  updateTag('settings');
}

export function str(fd: FormData, key: string, max = 4000) {
  return String(fd.get(key) ?? '').trim().slice(0, max);
}
export function bool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}
export function int(fd: FormData, key: string, min: number, max: number, fallback = 0) {
  const n = Math.round(Number(fd.get(key)));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
export function dateOrNull(fd: FormData, key: string) {
  const v = str(fd, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function fail(error: unknown, fallback = 'Não foi possível salvar.'): ActionResult {
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message: string }).message) : '';
  if (msg.includes('duplicate key')) return { error: 'Já existe um registro com esses dados.' };
  if (msg.includes('Acesso negado')) return { error: 'Acesso negado.' };
  return { error: fallback };
}
