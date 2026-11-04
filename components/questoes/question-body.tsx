import 'katex/dist/katex.min.css';
import type { QBloco } from '@/lib/question-types';
import { rich, richTex } from '@/lib/rich';
import { QImage } from './q-image';

const Html = ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;

/** Enunciado: textos (Markdown + LaTeX), equações, tabelas e imagens, na ordem do JSON. */
export function QuestionBody({ blocos }: { blocos: QBloco[] }) {
  return (
    <div className="q-rich space-y-3 text-[15px] text-ink-2">
      {blocos.map((b, i) => {
        if (b.tipo === 'texto') {
          if (b.estilo === 'fonte') return <Html key={i} html={rich(b.conteudo)} className="text-right text-[11px] text-muted" />;
          if (b.estilo === 'titulo') return <Html key={i} html={rich(b.conteudo)} className="font-bold text-ink" />;
          return <Html key={i} html={rich(b.conteudo)} />;
        }
        if (b.tipo === 'equacao') return <Html key={i} html={richTex(b.latex)} className="overflow-x-auto text-center" />;
        if (b.tipo === 'imagem') return b.dividida ? null : <QImage key={i} img={b} className={b.parte ? 'my-0 rounded-none p-0' : undefined} />;
        if (b.tipo === 'tabela')
          return (
            <div key={i} className="overflow-x-auto">
              <table>
                {b.legenda && <caption dangerouslySetInnerHTML={{ __html: rich(b.legenda, true) }} />}
                {b.cabecalho.length > 0 && (
                  <thead>
                    <tr>
                      {b.cabecalho.map((c, j) => (
                        <th key={j} dangerouslySetInnerHTML={{ __html: rich(c, true) }} />
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {b.linhas.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k} dangerouslySetInnerHTML={{ __html: rich(c, true) }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return null;
      })}
    </div>
  );
}
