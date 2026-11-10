/** Formato do pacote provas.json (o mesmo para o importador e para o servidor). */
export interface QImg {
  arquivo: string; // ex.: img/brasil_q094_regua.webp
  url?: string | null; // preenchida na importação (R2)
  largura?: number | null;
  altura?: number | null;
  alt?: string | null;
  /** imagem que já foi recortada em pedaços (alternativas em cada letra, ou imagem alta em partes): não aparece */
  dividida?: boolean;
  /** pedaço de uma imagem alta (vem logo depois da original) */
  parte?: boolean;
}
export type QBloco =
  | { tipo: 'texto'; estilo?: 'corpo' | 'titulo' | 'fonte'; conteudo: string }
  | ({ tipo: 'imagem' } & QImg)
  | { tipo: 'equacao'; latex: string }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][]; legenda?: string | null };
export interface QAlternativa {
  letra: string;
  texto: string;
  imagem?: QImg | null;
}
export interface QuestaoIn {
  id: string;
  numero: number;
  banca?: string;
  ano?: number;
  areaSigla?: string;
  areaConhecimento?: string;
  disciplina?: string;
  assuntoGeral?: string;
  assuntoEspecifico?: string;
  competencia?: string;
  habilidade?: string;
  gabarito?: string;
  status?: string;
  parametros?: { a?: number | null; b?: number | null; c?: number | null };
  blocos?: QBloco[];
  alternativas?: QAlternativa[];
  imagemAlternativas?: QImg | QImg[] | null;
  resolucao?: string | null;
  microdados?: Record<string, unknown> | null;
}
export interface ProvaIn {
  provaId: string;
  banca?: string;
  exame?: string;
  ano?: number;
  dia?: string;
  caderno?: string;
  aplicacao?: string;
  totalQuestoes?: number;
  questoes: QuestaoIn[];
}

/** Todas as imagens citadas numa questão (enunciado, alternativas e imagem das alternativas). */
export function imagesOf(q: QuestaoIn): QImg[] {
  const out: QImg[] = [];
  for (const b of q.blocos ?? []) if (b?.tipo === 'imagem' && b.arquivo) out.push(b);
  for (const a of q.alternativas ?? []) if (a?.imagem?.arquivo) out.push(a.imagem);
  const ia = q.imagemAlternativas;
  for (const i of Array.isArray(ia) ? ia : ia ? [ia] : []) if (i?.arquivo) out.push(i);
  return out;
}

/** "img/brasil_q094_regua.webp" → "brasil_q094_regua.webp" (é assim que o arquivo é achado na pasta) */
export const fileName = (arquivo: string) => arquivo.split(/[\\/]/).pop() ?? arquivo;

/**
 * Vestibular da questão (Enem, Cesupa…), a partir do exame da prova ou da banca.
 * Guardado em maiúsculas; o Enem às vezes vem só como banca INEP.
 */
export function vestibularOf(exame?: string | null, banca?: string | null) {
  const raw = (exame || banca || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  if (!raw) return '';
  if (/ENEM|INEP/.test(raw)) return 'ENEM';
  if (raw.includes('CESUPA')) return 'CESUPA';
  return raw.slice(0, 40);
}
const VEST_NAMES: Record<string, string> = { ENEM: 'Enem', CESUPA: 'Cesupa' };
/** Nome do vestibular para mostrar ("Enem", "Cesupa"; os outros como vieram). */
export const vestLabel = (v: string) => VEST_NAMES[v] ?? v;
/** "Enem 2023": vestibular e ano da questão. */
export const vestYear = (q: { vestibular?: string | null; exame?: string | null; banca?: string | null; ano?: number | null; paper_ano?: number | null }) =>
  [vestLabel(q.vestibular || vestibularOf(q.exame, q.banca)), q.ano ?? q.paper_ano].filter(Boolean).join(' ');

export const DIFFICULTY = [
  { key: 'facil', label: 'Fácil', max: 0.8 },
  { key: 'media', label: 'Média', max: 1.6 },
  { key: 'dificil', label: 'Difícil', max: Infinity },
] as const;
export type Difficulty = (typeof DIFFICULTY)[number]['key'];
/** Dificuldade pelo parâmetro b da TRI (quanto maior, mais difícil). */
export function difficultyOf(b: number | null | undefined): Difficulty | null {
  if (b === null || b === undefined || !Number.isFinite(b)) return null;
  return DIFFICULTY.find((d) => b < d.max)!.key;
}

/** Imagem(ns) com as alternativas desenhadas, a mostrar abaixo do enunciado (nada se já foram para as letras). */
export function altImagesToShow(q: { alternativas: QAlternativa[]; imagem_alternativas: QImg | QImg[] | null }) {
  const list = Array.isArray(q.imagem_alternativas) ? q.imagem_alternativas : q.imagem_alternativas ? [q.imagem_alternativas] : [];
  if (q.alternativas.every((a) => a.imagem?.url) || list.some((i) => i.dividida)) return [];
  return list;
}

/** Alternativas sem texto nem imagem (as letras estão desenhadas numa imagem só). */
export const blankAlternatives = (q: { alternativas: QAlternativa[] }) => q.alternativas.every((a) => !a.texto?.trim() && !a.imagem?.url);
