/**
 * Assuntos da trilha da mentoria: os assuntos do banco de questões (taxonomia do professor), para que cada
 * etapa tenha questões de verdade. Mesmo formato do catálogo antigo (disciplinas → blocos → itens), então
 * as telas de escolher assuntos e períodos continuam iguais.
 * Prioridade (cobrança no ENEM) e o mapa do cronograma antigo vêm de lib/trilha-data.ts (gerado).
 */
import { TAXONOMY, type TaxDisc } from '@/lib/taxonomy';
import { LEGACY_KEYS, TRILHA_PRIORITY } from '@/lib/trilha-data';

export interface MatrizItem {
  key: string;
  title: string;
  priority: number;
}
export interface MatrizBlock {
  title: string;
  items: MatrizItem[];
}
export interface MatrizDiscipline {
  key: string;
  name: string;
  blocks: MatrizBlock[];
}

const DISC: { key: string; name: TaxDisc }[] = [
  { key: 'matematica', name: 'Matemática' },
  { key: 'fisica', name: 'Física' },
  { key: 'quimica', name: 'Química' },
  { key: 'biologia', name: 'Biologia' },
];

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "Mecânica: Dinâmica" → bloco "Mecânica"; sem dois-pontos o assunto é o próprio bloco. */
const blockOf = (assunto: string) => (assunto.includes(':') ? assunto.split(':')[0].trim() : assunto);

export const DISCIPLINES: MatrizDiscipline[] = DISC.map((d) => {
  const blocks: MatrizBlock[] = [];
  for (const t of TAXONOMY[d.name]) {
    const title = blockOf(t.assunto);
    let b = blocks.find((x) => x.title === title);
    if (!b) blocks.push((b = { title, items: [] }));
    const key = `${d.key}.${slug(t.assunto)}`;
    b.items.push({ key, title: t.assunto, priority: TRILHA_PRIORITY[key] ?? 1 });
  }
  return { key: d.key, name: d.name, blocks };
});

export interface Assunto {
  key: string;
  discipline: string;
  disciplineName: string;
  block: string;
  /** nome do assunto, igual ao "assunto geral" das questões do banco */
  title: string;
  /** sem o prefixo do bloco ("Dinâmica" em "Mecânica: Dinâmica") */
  short: string;
  /** posição na ordem didática da disciplina */
  index: number;
  priority: number;
}

export const ASSUNTOS: Assunto[] = DISCIPLINES.flatMap((d) => {
  let index = 0;
  return d.blocks.flatMap((b) =>
    b.items.map((i) => ({
      key: i.key,
      discipline: d.key,
      disciplineName: d.name,
      block: b.title,
      title: i.title,
      short: i.title.includes(':') ? i.title.split(':').slice(1).join(':').trim() : i.title,
      index: index++,
      priority: i.priority,
    })),
  );
});

export const ASSUNTO_BY_KEY = new Map(ASSUNTOS.map((a) => [a.key, a]));
export const DISCIPLINE_NAME: Record<string, string> = Object.fromEntries(DISC.map((d) => [d.key, d.name]));

/** Assunto da trilha para um conteúdo do cronograma antigo (ou ele mesmo, se já for da trilha). */
export const trilhaKey = (key: string) => (ASSUNTO_BY_KEY.has(key) ? key : (LEGACY_KEYS[key] ?? null));
