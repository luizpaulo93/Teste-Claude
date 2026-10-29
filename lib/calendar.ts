import type { CalendarEvent } from './types';
import { toISODate } from './utils';

export const EVENT_COLORS: Record<string, { dot: string; chip: string; label: string; band: string; circle: string }> = {
  blue: { dot: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-500 border-blue-500/25', label: 'Azul', band: 'bg-blue-500/25 border-blue-500/50', circle: 'bg-blue-500/20 border-blue-400/60' },
  violet: { dot: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-500 border-violet-500/25', label: 'Violeta', band: 'bg-violet-500/25 border-violet-500/50', circle: 'bg-violet-500/20 border-violet-400/60' },
  emerald: { dot: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25', label: 'Esmeralda', band: 'bg-emerald-500/25 border-emerald-500/50', circle: 'bg-emerald-500/20 border-emerald-400/60' },
  amber: { dot: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-500 border-amber-500/25', label: 'Âmbar', band: 'bg-amber-500/25 border-amber-500/50', circle: 'bg-amber-500/20 border-amber-400/60' },
  cyan: { dot: 'bg-cyan-500', chip: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/25', label: 'Celeste', band: 'bg-cyan-500/25 border-cyan-500/50', circle: 'bg-cyan-500/20 border-cyan-400/60' },
  rose: { dot: 'bg-rose-500', chip: 'bg-rose-500/15 text-rose-500 border-rose-500/25', label: 'Coral', band: 'bg-rose-500/25 border-rose-500/50', circle: 'bg-rose-500/25 border-rose-500/80' },
  pink: { dot: 'bg-pink-500', chip: 'bg-pink-500/15 text-pink-500 border-pink-500/25', label: 'Magenta', band: 'bg-pink-500/25 border-pink-500/50', circle: 'bg-pink-500/20 border-pink-400/60' },
  indigo: { dot: 'bg-indigo-500', chip: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/25', label: 'Índigo', band: 'bg-indigo-500/25 border-indigo-500/50', circle: 'bg-indigo-500/20 border-indigo-400/60' },
  teal: { dot: 'bg-teal-500', chip: 'bg-teal-500/15 text-teal-500 border-teal-500/25', label: 'Turquesa', band: 'bg-teal-500/25 border-teal-500/50', circle: 'bg-teal-500/20 border-teal-400/60' },
  slate: { dot: 'bg-slate-400', chip: 'bg-slate-400/15 text-slate-400 border-slate-400/25', label: 'Cinza', band: 'bg-slate-400/20 border-slate-400/40', circle: 'bg-slate-400/20 border-slate-400/50' },
};

/** Cor fixa por categoria (como no MemberClass); "evento do curso" usa a cor escolhida. */
export function eventColor(category: string, chosen: string) {
  if (category === 'assunto_semana' || category === 'simulado') return 'blue';
  if (category === 'revisao') return 'amber';
  if (category.startsWith('feriado')) return 'rose';
  return EVENT_COLORS[chosen] ? chosen : 'blue';
}

export const EVENT_CATEGORIES: Record<string, string> = {
  assunto_semana: 'Assunto da semana',
  evento_curso: 'Evento do curso',
  simulado: 'Simulado',
  revisao: 'Revisão',
  feriado: 'Feriado',
  feriado_nacional: 'Feriado nacional',
  feriado_para: 'Feriado no Pará',
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

/** Feriados nacionais e do Pará (inclui Círio, Pós-Círio e Recírio de Nazaré). */
export function holidays(year: number): CalendarEvent[] {
  const e = easter(year);
  const rel = (days: number) => {
    const d = new Date(e);
    d.setDate(d.getDate() + days);
    return toISODate(d);
  };
  const fixed = (m: number, d: number) => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Círio: 2º domingo de outubro
  const oct1 = new Date(year, 9, 1).getDay();
  const cirio = 1 + ((7 - oct1) % 7) + 7;
  const list: [string, string, 'feriado_nacional' | 'feriado_para'][] = [
    [fixed(1, 1), 'Confraternização Universal', 'feriado_nacional'],
    [rel(-48), 'Carnaval (segunda-feira)', 'feriado_nacional'],
    [rel(-47), 'Carnaval (terça-feira)', 'feriado_nacional'],
    [rel(-2), 'Sexta-feira Santa', 'feriado_nacional'],
    [rel(0), 'Páscoa', 'feriado_nacional'],
    [fixed(4, 21), 'Tiradentes', 'feriado_nacional'],
    [fixed(5, 1), 'Dia do Trabalhador', 'feriado_nacional'],
    [rel(60), 'Corpus Christi', 'feriado_nacional'],
    [fixed(8, 15), 'Adesão do Grão-Pará', 'feriado_para'],
    [fixed(9, 7), 'Independência do Brasil', 'feriado_nacional'],
    [fixed(10, cirio), 'Círio de Nazaré', 'feriado_para'],
    [fixed(10, cirio + 1), 'Pós-Círio de Nazaré', 'feriado_para'],
    [fixed(10, 12), 'Nossa Senhora Aparecida', 'feriado_nacional'],
    [fixed(10, cirio + 15), 'Recírio de Nazaré', 'feriado_para'],
    [fixed(11, 2), 'Finados', 'feriado_nacional'],
    [fixed(11, 15), 'Proclamação da República', 'feriado_nacional'],
    [fixed(11, 20), 'Consciência Negra', 'feriado_nacional'],
    [fixed(12, 8), 'Nossa Senhora da Conceição', 'feriado_para'],
    [fixed(12, 25), 'Natal', 'feriado_nacional'],
  ];
  return list.map(([date, title, category]) => ({
    id: `h-${date}-${title}`,
    title,
    description: category === 'feriado_para' ? 'Feriado no Pará' : 'Feriado nacional',
    category: category as CalendarEvent['category'],
    start_date: date,
    end_date: date,
    color: 'rose',
    is_published: true,
  }));
}
