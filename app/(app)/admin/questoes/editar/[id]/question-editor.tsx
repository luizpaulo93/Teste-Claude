'use client';

import 'katex/dist/katex.min.css';
import { AlertTriangle, ArrowRight, Check, ImageIcon, ImageUp, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { Button, buttonClass, Card, Select } from '@/components/ui';
import { Spinner } from '@/components/ui-client';
import type { QAlternativa, QBloco, QImg } from '@/lib/question-types';
import type { PaperProblem } from '@/lib/questions';
import { cn } from '@/lib/utils';
import { attachQuestionImage, previewFields, saveQuestionEdit, type PreviewField, type QuestionDraft } from '../../edit-actions';

type Field = PreviewField & { key: string; label: string };
type Remaining = (PaperProblem & { qid: string })[];

const LABEL = 'font-mono text-[11px] tracking-[0.06em] text-muted uppercase';

/** Lista plana dos campos de texto da questão (para pré-visualizar e checar cada um). */
function fieldsOf(d: QuestionDraft, hasResBlocks: boolean): Field[] {
  const out: Field[] = [];
  const blocks = (list: QBloco[], p: string, name: string) =>
    list.forEach((b, i) => {
      if (b.tipo === 'texto') out.push({ key: `${p}${i}`, label: `${name} · texto ${i + 1}`, kind: 'text', src: b.conteudo });
      else if (b.tipo === 'equacao') out.push({ key: `${p}${i}`, label: `${name} · equação`, kind: 'tex', src: b.latex });
      else if (b.tipo === 'tabela') {
        if (b.legenda != null) out.push({ key: `${p}${i}:l`, label: 'legenda', kind: 'text', src: b.legenda ?? '' });
        b.cabecalho.forEach((c, j) => out.push({ key: `${p}${i}:h${j}`, label: 'cabeçalho', kind: 'text', src: c }));
        b.linhas.forEach((r, j) => r.forEach((c, k) => out.push({ key: `${p}${i}:r${j}:${k}`, label: 'célula', kind: 'text', src: c })));
      }
    });
  blocks(d.blocos, 'b', 'Enunciado');
  d.alternativas.forEach((a, i) => out.push({ key: `a${i}`, label: `Alternativa ${a.letra}`, kind: 'text', src: a.texto }));
  if (hasResBlocks) blocks(d.resolucao_blocos, 'r', 'Resolução');
  else out.push({ key: 'res', label: 'Resolução', kind: 'text', src: d.resolucao });
  return out;
}

export function QuestionEditor({
  id,
  paperId,
  numero,
  paperLabel,
  initial,
  focus,
  imgAlts = [],
}: {
  id: string;
  paperId: string;
  numero: number;
  paperLabel: string;
  initial: QuestionDraft;
  /** imagem única com as alternativas (quando a prova traz assim) */
  imgAlts?: QImg[];
  /** onde está o problema (enunciado, alternativa B, resolução) */
  focus?: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<QuestionDraft>(initial);
  const hasResBlocks = initial.resolucao_blocos.length > 0;
  const fields = useMemo(() => fieldsOf(d, hasResBlocks), [d, hasResBlocks]);
  const [prev, setPrev] = useState<Record<string, { html: string; problems: string[] }>>({});
  const [saving, setSaving] = useState(false);
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const scrolled = useRef(false);

  // pré-visualização e checagem no servidor (o mesmo motor que mostra a questão ao aluno)
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(
      async () => {
        const r = await previewFields(fields.map(({ kind, src }) => ({ kind, src }))).catch(() => null);
        if (!alive || !r) return;
        setPrev(Object.fromEntries(fields.map((f, i) => [f.key, r[i]])));
      },
      scrolled.current ? 450 : 0,
    );
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [fields]);

  // abre já no campo com problema
  useEffect(() => {
    if (scrolled.current || !Object.keys(prev).length) return;
    scrolled.current = true;
    const bad = fields.find((f) => prev[f.key]?.problems.length);
    const want = bad?.key ?? (focus?.startsWith('alternativa') ? `a${d.alternativas.findIndex((a) => focus.endsWith(` ${a.letra}`))}` : focus?.startsWith('resol') ? (hasResBlocks ? 'r0' : 'res') : null);
    if (want) document.getElementById(`f-${want}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [prev, fields, focus, d.alternativas, hasResBlocks]);

  const problems = fields.filter((f) => prev[f.key]?.problems.length);
  // imagens citadas que não chegaram (a questão fica sem a figura para o aluno)
  const missingImgs = [
    ...d.blocos.filter((b): b is Extract<QBloco, { tipo: 'imagem' }> => b.tipo === 'imagem' && !b.url && !b.parte),
    ...d.alternativas.flatMap((a) => (a.imagem?.arquivo && !a.imagem.url ? [a.imagem] : [])),
    ...imgAlts.filter((i) => i.arquivo && !i.url),
    ...d.resolucao_blocos.filter((b): b is Extract<QBloco, { tipo: 'imagem' }> => b.tipo === 'imagem' && !b.url && !b.parte),
  ];
  const [uploading, setUploading] = useState('');

  /** Envia a imagem escolhida para o lugar dela (salva antes o que foi digitado, para não perder). */
  async function uploadImg(arquivo: string, file: File) {
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return toast.error('Escolha uma imagem (JPG, PNG ou WEBP).');
    if (file.size > 10 * 1024 * 1024) return toast.error('Imagem muito grande (máx. 10 MB).');
    setUploading(arquivo);
    try {
      if (dirty) {
        const r = await saveQuestionEdit(id, d);
        if (r.error) throw new Error(r.error);
      }
      const res = await fetch('/api/storage/upload-batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ folder: `questoes/${paperId}`, files: [{ contentType: file.type, size: file.size }] }),
      });
      const data = await res.json().catch(() => ({}));
      const it = data?.items?.[0];
      if (!res.ok || !it?.uploadUrl) throw new Error(it?.error || data?.error || 'Não foi possível preparar o envio.');
      const put = await fetch(it.uploadUrl, { method: 'PUT', headers: it.headers, body: file });
      if (!put.ok) throw new Error('Falha ao enviar a imagem.');
      const r = await attachQuestionImage(id, arquivo, it.publicUrl);
      if (r.error) throw new Error(r.error);
      toast('Imagem enviada.');
      setRemaining(r.remaining ?? []);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar a imagem.');
    } finally {
      setUploading('');
    }
  }

  const setBlock = (which: 'blocos' | 'resolucao_blocos', i: number, patch: (b: QBloco) => QBloco) =>
    setD((x) => ({ ...x, [which]: x[which].map((b, k) => (k === i ? patch(b) : b)) }));

  async function save() {
    setSaving(true);
    const r: Awaited<ReturnType<typeof saveQuestionEdit>> = await saveQuestionEdit(id, d).catch(() => ({ error: 'Sem conexão.' }));
    setSaving(false);
    if (r.error) return toast.error(r.error);
    toast('Questão salva.');
    setRemaining(r.remaining ?? []);
    router.refresh();
  }

  const blockEditor = (which: 'blocos' | 'resolucao_blocos', p: string) =>
    d[which].map((b, i) => {
      if (b.tipo === 'texto')
        return (
          <FieldBox key={i} fkey={`${p}${i}`} label={b.estilo === 'fonte' ? 'Fonte' : b.estilo === 'titulo' ? 'Título' : 'Texto'} prev={prev[`${p}${i}`]}>
            <TextArea value={b.conteudo} onChange={(v) => setBlock(which, i, (x) => ({ ...(x as typeof b), conteudo: v }))} />
          </FieldBox>
        );
      if (b.tipo === 'equacao')
        return (
          <FieldBox key={i} fkey={`${p}${i}`} label="Equação (LaTeX, sem $)" prev={prev[`${p}${i}`]}>
            <TextArea mono value={b.latex} onChange={(v) => setBlock(which, i, (x) => ({ ...(x as typeof b), latex: v }))} />
          </FieldBox>
        );
      if (b.tipo === 'imagem') return b.parte ? null : <ImageSlot key={i} img={b} onFile={(f) => uploadImg(b.arquivo, f)} busy={uploading === b.arquivo} />;
      if (b.tipo === 'tabela')
        return (
          <div key={i} className="space-y-2 rounded-lg border border-line p-2.5">
            <p className={LABEL}>Tabela</p>
            {b.legenda != null && (
              <FieldBox fkey={`${p}${i}:l`} label="Legenda" prev={prev[`${p}${i}:l`]} compact>
                <TextArea value={b.legenda ?? ''} onChange={(v) => setBlock(which, i, (x) => ({ ...(x as typeof b), legenda: v }))} />
              </FieldBox>
            )}
            {[b.cabecalho, ...b.linhas].map((row, j) => (
              <div key={j} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, row.length)}, minmax(0, 1fr))` }}>
                {row.map((c, k) => {
                  const fk = j === 0 ? `${p}${i}:h${k}` : `${p}${i}:r${j - 1}:${k}`;
                  const bad = prev[fk]?.problems.length;
                  return (
                    <input
                      key={k}
                      id={`f-${fk}`}
                      value={c}
                      title={bad ? prev[fk].problems.join(' · ') : undefined}
                      onChange={(e) =>
                        setBlock(which, i, (x) => {
                          const t = x as typeof b;
                          return j === 0
                            ? { ...t, cabecalho: t.cabecalho.map((y, z) => (z === k ? e.target.value : y)) }
                            : { ...t, linhas: t.linhas.map((r, rj) => (rj === j - 1 ? r.map((y, z) => (z === k ? e.target.value : y)) : r)) };
                        })
                      }
                      className={cn(
                        'h-9 min-w-0 rounded-md border bg-bg-elev px-2 text-xs text-ink',
                        bad ? 'border-danger' : 'border-line-strong',
                        j === 0 && 'font-semibold',
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        );
      return null;
    });

  return (
    <div className="space-y-5 pb-24">
      <Card className={cn('flex items-start gap-3 p-4', problems.length ? 'border-danger/40' : 'border-success/40')}>
        {problems.length || missingImgs.length ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" /> : <Check className="mt-0.5 size-5 shrink-0 text-success" />}
        <div className="min-w-0 text-sm">
          {missingImgs.length > 0 && (
            <div className="mb-2">
              <p className="font-semibold text-ink">
                {missingImgs.length} {missingImgs.length === 1 ? 'imagem não enviada' : 'imagens não enviadas'}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
                {missingImgs.map((m) => (
                  <li key={m.arquivo}>
                    <button
                      type="button"
                      onClick={() => document.getElementById(`img-${m.arquivo}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                      className="text-left hover:text-ink"
                    >
                      {m.arquivo.split('/').pop()} — toque em <b className="text-ink">Enviar imagem</b> no lugar dela
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {problems.length ? (
            <>
              <p className="font-semibold text-ink">
                {problems.length} {problems.length === 1 ? 'campo com problema' : 'campos com problema'}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-ink-2">
                {problems.map((f) => (
                  <li key={f.key}>
                    <button type="button" onClick={() => document.getElementById(`f-${f.key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })} className="text-left hover:text-ink">
                      <b className="text-ink">{f.label}</b>: {prev[f.key].problems.join(' · ')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-semibold text-ink">
              {Object.keys(prev).length ? `Nenhum problema nas fórmulas${missingImgs.length ? '' : ' desta questão'}.` : 'Conferindo as fórmulas…'}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-muted">
            Fórmulas dentro do texto vão entre $…$ (ex.: $v = \frac{'{'}d{'}'}{'{'}t{'}'}$). Acento e aspas dentro de fórmula: use \text{'{'}…{'}'}.
          </p>
        </div>
      </Card>

      <Section title="Enunciado">{blockEditor('blocos', 'b')}</Section>

      <Section title="Alternativas">
        {d.alternativas.map((a: QAlternativa, i) => (
          <FieldBox key={a.letra} fkey={`a${i}`} label={`Alternativa ${a.letra}${a.letra === d.gabarito ? ' · correta' : ''}`} prev={prev[`a${i}`]}>
            <TextArea value={a.texto} onChange={(v) => setD((x) => ({ ...x, alternativas: x.alternativas.map((y, k) => (k === i ? { ...y, texto: v } : y)) }))} />
            {a.imagem?.arquivo && <ImageSlot img={a.imagem} onFile={(f) => uploadImg(a.imagem!.arquivo, f)} busy={uploading === a.imagem.arquivo} />}
          </FieldBox>
        ))}
        {imgAlts.map((img) => (
          <ImageSlot key={img.arquivo} img={img} label="Imagem das alternativas" onFile={(f) => uploadImg(img.arquivo, f)} busy={uploading === img.arquivo} />
        ))}
        <label className="flex items-center gap-3">
          <span className={LABEL}>Gabarito</span>
          <Select value={d.gabarito} onChange={(e) => setD((x) => ({ ...x, gabarito: e.target.value }))} className="h-9 w-24 text-sm">
            {d.alternativas.map((a) => (
              <option key={a.letra} value={a.letra}>
                {a.letra}
              </option>
            ))}
          </Select>
        </label>
      </Section>

      <Section title="Resolução">
        {hasResBlocks ? (
          blockEditor('resolucao_blocos', 'r')
        ) : (
          <FieldBox fkey="res" label="Resolução" prev={prev.res}>
            <TextArea value={d.resolucao} onChange={(v) => setD((x) => ({ ...x, resolucao: v }))} rows={6} />
          </FieldBox>
        )}
      </Section>

      {remaining && (
        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">
            {remaining.length ? `Ainda há ${new Set(remaining.map((r) => r.qid)).size} questão(ões) com problema nesta prova` : 'Esta prova não tem mais problemas.'}
          </p>
          <ul className="space-y-1">
            {remaining.slice(0, 12).map((r, k) => (
              <li key={k}>
                <Link href={`/admin/questoes/editar/${encodeURIComponent(r.qid)}?onde=${encodeURIComponent(r.onde)}`} className="flex items-center gap-1.5 text-xs text-ink-2 hover:text-brand">
                  <b className="text-ink">Questão {r.n}</b> ({r.onde}): {r.msg} <ArrowRight className="size-3" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/admin/questoes" className={buttonClass('secondary', 'sm')}>
            Voltar às provas
          </Link>
        </Card>
      )}

      {/* barra de salvar sempre à mão */}
      <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-xl border border-line-strong bg-surface/95 p-2.5 pl-4 shadow-2xl backdrop-blur lg:bottom-4">
        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          Questão {numero} · {paperLabel}
        </span>
        <Link href="/admin/questoes" className={buttonClass('ghost', 'sm')}>
          Voltar
        </Link>
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <Spinner /> : <Save className="size-4" />} Salvar
        </Button>
      </div>
    </div>
  );
}

/** Imagem da questão: mostra a que está no app ou avisa que falta; escolher um arquivo envia (ou troca). */
function ImageSlot({ img, onFile, busy, label }: { img: QImg; onFile: (f: File) => void; busy: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const name = img.arquivo.split('/').pop();
  return (
    <div
      id={`img-${img.arquivo}`}
      className={cn('flex scroll-mt-24 items-center gap-3 rounded-lg border p-2.5', img.url ? 'border-line bg-surface-2/50' : 'border-danger/60 bg-danger/5')}
    >
      {img.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt="" className="h-14 w-auto max-w-32 shrink-0 rounded bg-white object-contain p-0.5" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded bg-danger/10 text-danger">
          <ImageIcon className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-muted">
          {label ?? 'Imagem'} · {name}
        </span>
        {!img.url && <span className="block text-xs font-medium text-danger">Imagem não enviada: o aluno vê a questão sem a figura.</span>}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <Button size="sm" variant={img.url ? 'secondary' : 'primary'} disabled={busy} onClick={() => input.current?.click()} className="shrink-0">
        {busy ? <Spinner /> : <ImageUp className="size-4" />} {img.url ? 'Trocar' : 'Enviar imagem'}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function FieldBox({
  fkey,
  label,
  prev,
  children,
  compact,
}: {
  fkey: string;
  label: string;
  prev?: { html: string; problems: string[] };
  children: React.ReactNode;
  compact?: boolean;
}) {
  const bad = Boolean(prev?.problems.length);
  return (
    <div id={`f-${fkey}`} className={cn('scroll-mt-24 space-y-1.5 rounded-xl border p-3', bad ? 'border-danger/60 bg-danger/5' : 'border-line bg-surface')}>
      <p className={LABEL}>{label}</p>
      {children}
      {prev && !compact && (
        <div className="q-rich overflow-x-auto rounded-lg bg-surface-2/60 px-3 py-2 text-[14px] text-ink-2" dangerouslySetInnerHTML={{ __html: prev.html || '<span class="text-muted">(vazio)</span>' }} />
      )}
      {bad && (
        <p className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertTriangle className="size-3.5" /> {prev!.problems.join(' · ')}
        </p>
      )}
    </div>
  );
}

function TextArea({ value, onChange, mono, rows }: { value: string; onChange: (v: string) => void; mono?: boolean; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows ?? Math.min(10, Math.max(2, Math.ceil(value.length / 60)))}
      spellCheck={false}
      className={cn(
        'w-full rounded-lg border border-line-strong bg-bg-elev px-3 py-2 text-sm leading-relaxed text-ink focus:border-brand focus:ring-3 focus:ring-brand/15 focus:outline-none',
        mono && 'font-mono text-[13px]',
      )}
    />
  );
}
