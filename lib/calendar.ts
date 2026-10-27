import type { CalendarEvent } from './types';
import { toISODate } from './utils';

export const EVENT_COLORS: Record<string, { dot: string; chip: string; label: string }> = {
  blue: { dot: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-500 border-blue-500/25', label: 'Azul' },
  violet: { dot: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-500 border-violet-500/25', label: 'Violeta' },
  emerald: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25', label: 'Verde' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-500 border-amber-500/25', label: 'Âmbar' },
  cyan: { dot: 'bg-cyan-500', chip: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/25', label: 'Ciano' },
  rose: { dot: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-500 border-rose-500/25', label: 'Rosa' },
  slate: { dot: 'bg-slate-400', chip: 'bg-slate-400/15 text-slate-400 border-slate-400/25', label: 'Cinza' },
};

export const EVENT_CATEGORIES: Record<string, string> = {
  assunto_semana: 'Assunto da semana',
  evento_curso: 'Evento do curso',
  simulado: 'Simulado',
  revisao: 'Revisão',
  feriado: 'Feriado',
  aviso: 'Aviso',
};

function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function holidays(year: number): CalendarEvent[] {
  const e = easter(year);
  const rel = (days: number) => {
    const d = new Date(e);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  const fixed = (m: number, d: number) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const list: [string, string][] = [
    [fixed(1, 1), 'Confraternização Universal'],
    [rel(-48), 'Carnaval'],
    [rel(-47), 'Carnaval'],
    [rel(-2), 'Sexta-feira Santa'],
    [fixed(4, 21), 'Tiradentes'],
    [fixed(5, 1), 'Dia do Trabalho'],
    [rel(60), 'Corpus Christi'],
    [fixed(8, 15), 'Adesão do Pará'],
    [fixed(9, 7), 'Independência do Brasil'],
    [fixed(10, 12), 'Nossa Senhora Aparecida'],
    [fixed(11, 2), 'Finados'],
    [fixed(11, 15), 'Proclamação da República'],
    [fixed(11, 20), 'Consciência Negra'],
    [fixed(12, 25), 'Natal'],
  ];
  return list.map(([date, title]) => ({
    id: `h-${date}-${title}`,
    title,
    description: '',
    category: 'feriado',
    start_date: date,
    end_date: date,
    color: 'slate',
    is_published: true,
  }));
}
