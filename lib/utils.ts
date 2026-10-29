import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind resolvendo conflitos (ex.: "inline-flex" + "hidden sm:inline-flex" esconde no celular). */
export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(' '));
}

export function extractYoutubeId(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  try {
    if (raw.includes('youtu.be/')) {
      const id = (raw.split('youtu.be/')[1] || '').split(/[?&/#]/)[0];
      if (/^[\w-]{6,64}$/.test(id)) return id;
    }
    if (raw.includes('youtube.com/')) {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      const v = url.searchParams.get('v');
      if (v && /^[\w-]{6,64}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      const i = parts.findIndex((p) => ['embed', 'shorts', 'live', 'v'].includes(p));
      if (i !== -1 && parts[i + 1] && /^[\w-]{6,64}$/.test(parts[i + 1])) return parts[i + 1];
    }
  } catch {
    // segue para o fallback
  }
  const m = raw.match(/^[\w-]{11}$/) || raw.match(/([\w-]{11})/);
  return m ? m[1] ?? m[0] : '';
}

export function youtubeThumb(id: string) {
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const dtf = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const dtfLong = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Para colunas `date` (YYYY-MM-DD) — sem deslocamento de fuso. */
export function formatDate(date: string, long = false) {
  if (!date) return '';
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return (long ? dtfLong : dtf).format(d);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d`;
  return formatDateTime(iso);
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** Segunda-feira da semana (YYYY-MM-DD), em horário local. */
export function weekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function firstName(name: string) {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** Escapa curingas do LIKE para comparar e-mails com ilike de forma exata (sem diferenciar maiúsculas). */
export function likeExact(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** IDs gerados pela plataforma (20 letras/números) e os criados no painel. */
export function isDocId(s: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(s);
}
