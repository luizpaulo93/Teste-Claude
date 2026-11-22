/**
 * Gera lib/trilha-data.ts: prioridade (cobrança no ENEM) de cada assunto da trilha e o mapa do
 * cronograma antigo (matriz do ENEM) para a trilha (assuntos do banco de questões).
 * Rodar: node --experimental-strip-types scripts/build-trilha.ts
 */
import { writeFileSync } from 'node:fs';
import { ASSUNTOS, DISCIPLINES } from '../lib/enem-matriz.ts';
import { classify, TAXONOMY } from '../lib/taxonomy.ts';

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const name: Record<string, string> = Object.fromEntries(DISCIPLINES.map((d) => [d.key, d.name]));
const keyOf = (disc: string, assunto: string) => `${disc}.${slug(assunto)}`;

const priority: Record<string, number> = {};
const legacy: Record<string, string> = {};
for (const a of ASSUNTOS) {
  const c = classify({ disciplina: name[a.discipline], assuntoGeral: a.block, assuntoEspecifico: a.title });
  if (!c) continue;
  const k = keyOf(a.discipline, c.assunto);
  legacy[a.key] = k;
  priority[k] = Math.max(priority[k] ?? 1, a.priority);
}
// todo assunto da taxonomia tem prioridade (1 se nenhum conteúdo da matriz caiu nele)
for (const d of DISCIPLINES) for (const t of TAXONOMY[name[d.key] as keyof typeof TAXONOMY] ?? []) priority[keyOf(d.key, t.assunto)] ??= 1;

const out = `// Gerado por scripts/build-trilha.ts — não editar à mão.
/** Cobrança no ENEM de cada assunto da trilha (3 = mais cobrado). */
export const TRILHA_PRIORITY: Record<string, number> = ${JSON.stringify(priority, null, 1)};
/** Cronograma antigo (conteúdo da matriz do ENEM) → assunto da trilha. */
export const LEGACY_KEYS: Record<string, string> = ${JSON.stringify(legacy, null, 1)};
`;
writeFileSync(new URL('../lib/trilha-data.ts', import.meta.url), out);
console.log('assuntos:', Object.keys(priority).length, '· mapa antigo:', Object.keys(legacy).length);
