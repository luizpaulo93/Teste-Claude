import 'server-only';
import { resolutionBlocksOf, type QBloco, type QImg } from '@/lib/question-types';
import { rich, richTex } from '@/lib/rich';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Imagem da resolução (tela): fundo branco também no tema escuro, sem passar da largura da tela. */
function imgHtml(i: QImg) {
  if (!i.url) return `<p class="q-res-missing">Imagem da resolução ainda não enviada (${esc(i.arquivo.split('/').pop() ?? '')})</p>`;
  const size = i.largura && i.altura ? ` width="${Math.round(i.largura)}" height="${Math.round(i.altura)}"` : '';
  const style = i.largura ? ` style="width:min(100%, ${Math.round(i.largura)}px)"` : '';
  return `<img class="q-res-img" src="${esc(i.url)}" alt="${esc(i.alt ?? '')}" loading="lazy"${size}${style}>`;
}

/** Blocos (texto, equação, tabela e imagem) em HTML, na ordem do JSON. `img` decide como a imagem aparece. */
export function blocksHtml(blocos: QBloco[], img: (i: QImg) => string = imgHtml) {
  const parts: string[] = [];
  for (const b of blocos) {
    if (b.tipo === 'texto') parts.push(`<div class="t ${b.estilo ?? 'corpo'}">${rich(b.conteudo)}</div>`);
    else if (b.tipo === 'equacao') parts.push(`<div class="eq q-res-eq">${richTex(b.latex)}</div>`);
    else if (b.tipo === 'imagem' && !b.dividida) parts.push(`<div class="fig">${img(b)}</div>`);
    else if (b.tipo === 'tabela') {
      const head = b.cabecalho.length ? `<thead><tr>${b.cabecalho.map((c) => `<th>${rich(c, true)}</th>`).join('')}</tr></thead>` : '';
      const body = b.linhas.map((r) => `<tr>${r.map((c) => `<td>${rich(c, true)}</td>`).join('')}</tr>`).join('');
      parts.push(`<div class="q-res-table"><table>${b.legenda ? `<caption>${rich(b.legenda, true)}</caption>` : ''}${head}<tbody>${body}</tbody></table></div>`);
    }
  }
  return parts.join('');
}

/**
 * Resolução pronta para a tela: os blocos (com as imagens no lugar em que aparecem) ou, nas questões
 * antigas sem blocos, o texto da resolução.
 */
export function resolutionHtml(q: { resolucao?: string | null; resolucao_blocos?: QBloco[] | null }, img?: (i: QImg) => string) {
  const blocos = resolutionBlocksOf(q);
  if (blocos.length) return `<div class="q-res">${blocksHtml(blocos, img)}</div>`;
  return rich(q.resolucao);
}

/** A questão tem resolução (texto ou blocos)? */
export const hasResolution = (q: { resolucao?: string | null; resolucao_blocos?: QBloco[] | null }) =>
  Boolean(q.resolucao?.trim()) || resolutionBlocksOf(q).length > 0;
