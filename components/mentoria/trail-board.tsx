'use client';

import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, Clock, Database, Flame, GripVertical, ListChecks, RefreshCw, Search, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { moveTrail, newListNow, reorderTrail, setListSize } from '@/app/(app)/mentoria/actions';
import { toast } from '@/components/toast';
import { Button, buttonClass, Input } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import type { BoardCard } from '@/lib/mentoria-data';
import { LEVELS } from '@/lib/mentoria';
import { cn, formatDate } from '@/lib/utils';

const COLS = [
  { level: 0, title: 'Teoria', hint: 'Fila: estudar a teoria' },
  { level: 1, title: 'Nível 1', hint: 'Questões básicas' },
  { level: 2, title: 'Nível 2', hint: 'Abaixo do ENEM' },
  { level: 3, title: 'Nível 3', hint: 'Nível ENEM' },
  { level: 4, title: 'Dominado', hint: 'Revisões espaçadas' },
];
const QUEUE_SHOWN = 12;
const DAY = 86400000;

/** Alertas automáticos para o mentor: retido, lista parada, falta de questões no banco. */
export function boardAlerts(cards: BoardCard[], today: string) {
  const out: { id: string; tone: 'danger' | 'warning'; text: string }[] = [];
  for (const c of cards) {
    if (c.level >= 1 && c.level <= 3 && c.retained >= 2) out.push({ id: c.id, tone: 'danger', text: `${c.title}: ${c.retained} listas seguidas sem passar no ${LEVELS[c.level].label}` });
    if (c.list && !c.list.answered && (Date.parse(today) - Date.parse(c.list.since)) / DAY >= 5)
      out.push({ id: c.id, tone: 'warning', text: `${c.title}: lista do ${LEVELS[c.level].label} parada desde ${formatDate(c.list.since)}` });
    if (c.level >= 1 && c.level <= 3 && !c.list) out.push({ id: c.id, tone: 'danger', text: `${c.title}: sem questões no banco para o ${LEVELS[c.level].label}` });
    else if (c.level >= 1 && c.level <= 3 && c.bank[c.level] < c.size)
      out.push({ id: c.id, tone: 'warning', text: `${c.title}: o banco tem só ${c.bank[c.level]} questões de ${LEVELS[c.level].label} (completa com outros níveis)` });
  }
  return out;
}

/**
 * Quadro da trilha (como o Trello): uma coluna por etapa. Arraste o assunto (mouse ou dedo, segurando) para
 * outra coluna, ou use as setas. Na coluna Teoria, arrastar muda a ordem da fila.
 */
export function TrailBoard({
  mentoriaId,
  cards: initial,
  disciplines,
  today,
}: {
  mentoriaId: string;
  cards: BoardCard[];
  disciplines: { key: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  useEffect(() => setCards(initial), [initial]);
  const [disc, setDisc] = useState('');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; w: number; col: number | null; before: string | null } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return cards.filter((c) => (!disc || c.discipline === disc) && (!term || c.title.toLowerCase().includes(term) || c.block.toLowerCase().includes(term)));
  }, [cards, disc, q]);
  const colCards = (l: number) => visible.filter((c) => c.level === l).sort((a, b) => (l === 0 ? a.ord - b.ord : (a.scheduled ?? '').localeCompare(b.scheduled ?? '') || a.ord - b.ord));
  const alerts = boardAlerts(visible, today);
  const discName = Object.fromEntries(disciplines.map((d) => [d.key, d.name]));

  async function move(id: string, level: number) {
    const c = cards.find((x) => x.id === id);
    if (!c || c.level === level) return;
    const before = cards;
    setCards((cs) => cs.map((x) => (x.id === id ? { ...x, level, retained: 0, list: null } : x)));
    const r = await moveTrail(id, level, mentoriaId).catch(() => ({ error: 'Sem conexão.' }) as { error: string; noQuestions?: boolean });
    if (r.error) {
      setCards(before);
      return toast.error(r.error);
    }
    toast(
      level >= 1 && level <= 3
        ? 'noQuestions' in r && r.noQuestions
          ? `${c.title} no ${LEVELS[level].label}, mas o banco não tem questões deste assunto.`
          : `${c.title} no ${LEVELS[level].label}: a lista já foi criada para o aluno.`
        : level === 4
          ? `${c.title} dominado: entra nas revisões espaçadas.`
          : `${c.title} voltou para a teoria.`,
    );
    router.refresh();
  }

  async function reorder(id: string, beforeId: string | null) {
    const queue = cards.filter((c) => c.level === 0).sort((a, b) => a.ord - b.ord);
    const moving = queue.find((c) => c.id === id);
    if (!moving) return;
    const rest = queue.filter((c) => c.id !== id);
    const at = beforeId ? rest.findIndex((c) => c.id === beforeId) : rest.length;
    rest.splice(at < 0 ? rest.length : at, 0, moving);
    const ord = new Map(rest.map((c, i) => [c.id, i]));
    const others = cards.filter((c) => c.level !== 0);
    const before = cards;
    setCards([...rest.map((c) => ({ ...c, ord: ord.get(c.id)! })), ...others]);
    const r = await reorderTrail(
      rest.map((c) => c.id),
      mentoriaId,
    ).catch(() => ({ error: 'Sem conexão.' }));
    if (r.error) {
      setCards(before);
      toast.error(r.error);
    } else router.refresh();
  }

  // ---------- arrastar (mouse: depois de mexer 5px; dedo: segurando um instante, para não brigar com a rolagem)
  const start = useRef<{ id: string; x: number; y: number; t: number; pid: number; touch: boolean; el: HTMLElement } | null>(null);
  const timer = useRef(0);
  function where(x: number, y: number) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const col = el?.closest<HTMLElement>('[data-col]');
    const card = el?.closest<HTMLElement>('[data-card]');
    let before: string | null = null;
    if (col && col.dataset.col === '0') {
      // posição na fila: antes do primeiro cartão cujo meio está abaixo do dedo
      const items = [...col.querySelectorAll<HTMLElement>('[data-card]')];
      const next = items.find((it) => {
        const r = it.getBoundingClientRect();
        return y < r.top + r.height / 2 && it.dataset.card !== dragRef.current?.id;
      });
      before = next?.dataset.card ?? null;
    }
    void card;
    return { col: col ? Number(col.dataset.col) : null, before };
  }
  function begin(x: number, y: number) {
    const s = start.current;
    if (!s) return;
    const r = s.el.getBoundingClientRect();
    try {
      s.el.setPointerCapture(s.pid);
    } catch {}
    setDrag({ id: s.id, x, y, w: r.width, ...where(x, y) });
    if (navigator.vibrate) navigator.vibrate(8);
  }
  function onDown(e: React.PointerEvent<HTMLElement>, id: string) {
    if ((e.target as HTMLElement).closest('button, a')) return;
    if (e.button !== 0) return;
    start.current = { id, x: e.clientX, y: e.clientY, t: Date.now(), pid: e.pointerId, touch: e.pointerType !== 'mouse', el: e.currentTarget };
    if (e.pointerType !== 'mouse') {
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => begin(e.clientX, e.clientY), 260);
    }
  }
  function onMove(e: React.PointerEvent<HTMLElement>) {
    const s = start.current;
    if (!s || e.pointerId !== s.pid) return;
    if (!dragRef.current) {
      const far = Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > (s.touch ? 10 : 5);
      if (s.touch && far) {
        // mexeu antes de segurar: é rolagem, não arrasto
        clearTimeout(timer.current);
        start.current = null;
        return;
      }
      if (!s.touch && far) begin(e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, ...where(e.clientX, e.clientY) } : d));
  }
  function onUp(e: React.PointerEvent<HTMLElement>, id: string) {
    clearTimeout(timer.current);
    const s = start.current;
    start.current = null;
    const d = dragRef.current;
    if (!d) {
      // toque simples: abre os detalhes
      if (s && e.pointerId === s.pid && Date.now() - s.t < 500) setOpen(id);
      return;
    }
    setDrag(null);
    const c = cards.find((x) => x.id === d.id);
    if (!c || d.col === null) return;
    if (d.col !== c.level) void move(d.id, d.col);
    else if (d.col === 0) void reorder(d.id, d.before);
  }
  useEffect(() => {
    // durante o arrasto com o dedo, a página não rola
    if (!drag) return;
    const stop = (ev: TouchEvent) => ev.cancelable && ev.preventDefault();
    document.addEventListener('touchmove', stop, { passive: false });
    return () => document.removeEventListener('touchmove', stop);
  }, [drag]);

  const dragging = drag ? cards.find((c) => c.id === drag.id) : null;
  const detail = open ? cards.find((c) => c.id === open) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="rail -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
          {[{ key: '', name: 'Todas' }, ...disciplines].map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDisc(d.key)}
              aria-pressed={disc === d.key}
              className={cn(
                'shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
                disc === d.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2',
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar assunto" className="h-9 pl-8 text-xs" />
        </label>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-line bg-surface">
          <p className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-xs font-semibold text-ink">
            <AlertTriangle className="size-3.5 text-warning" /> Precisa de atenção
            <span className="num ml-auto font-normal text-muted">{alerts.length}</span>
          </p>
          <ul className="max-h-44 divide-y divide-line overflow-y-auto">
            {alerts.map((a, i) => (
              <li key={i}>
                <button type="button" onClick={() => setOpen(a.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs text-ink-2 hover:bg-surface-2">
                  <span className={cn('size-1.5 shrink-0 rounded-full', a.tone === 'danger' ? 'bg-danger' : 'bg-warning')} />
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rail -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {COLS.map((col) => {
          const list = colCards(col.level);
          const shown = col.level === 0 && !all ? list.slice(0, QUEUE_SHOWN) : list;
          const target = drag && drag.col === col.level;
          return (
            <section
              key={col.level}
              data-col={col.level}
              className={cn(
                'flex w-[78vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-xl border bg-surface-2/50 transition-colors sm:w-auto sm:max-w-none',
                target ? 'border-brand bg-brand-soft' : 'border-line',
              )}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span className={cn('size-2 rounded-full', LEVELS[col.level].dot)} />
                <h3 className="text-[13px] font-semibold text-ink">{col.title}</h3>
                <span className="num ml-auto text-[11px] text-muted">{list.length}</span>
              </header>
              <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.04em] text-muted uppercase">{col.hint}</p>
              <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {shown.map((c) => (
                  <li
                    key={c.id}
                    data-card={c.id}
                    onPointerDown={(e) => onDown(e, c.id)}
                    onPointerMove={onMove}
                    onPointerUp={(e) => onUp(e, c.id)}
                    onPointerCancel={() => {
                      clearTimeout(timer.current);
                      start.current = null;
                      setDrag(null);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      'group relative cursor-grab touch-manipulation rounded-lg border bg-surface p-2.5 select-none hover:border-line-strong active:cursor-grabbing',
                      c.hard ? 'border-danger/35' : 'border-line',
                      drag?.id === c.id && 'opacity-35',
                      drag && drag.col === 0 && col.level === 0 && drag.before === c.id && 'shadow-[0_-2px_0_0_var(--brand)]',
                    )}
                  >
                    <CardFace c={c} discName={discName[c.discipline] ?? c.discipline} showDisc={!disc} />
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(c.id, c.level - 1)}
                        disabled={c.level === 0}
                        aria-label="Voltar uma etapa"
                        className="grid size-7 place-items-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(c.id, c.level + 1)}
                        disabled={c.level === 4}
                        aria-label="Avançar uma etapa"
                        className="grid size-7 place-items-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                      <GripVertical className="ml-auto size-3.5 text-muted/60" aria-hidden />
                    </div>
                  </li>
                ))}
                {col.level === 0 && list.length > QUEUE_SHOWN && (
                  <button type="button" onClick={() => setAll((v) => !v)} className="rounded-md py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-ink">
                    {all ? 'Mostrar só os próximos' : `Mostrar todos (${list.length})`}
                  </button>
                )}
                {!list.length && <li className="grid flex-1 place-items-center py-6 text-center text-[11px] text-muted">Arraste um assunto para cá</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {drag && dragging && (
        <div
          className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 rotate-2 rounded-lg border border-brand bg-surface p-2.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]"
          style={{ left: drag.x, top: drag.y, width: Math.min(drag.w, 280) }}
        >
          <CardFace c={dragging} discName={discName[dragging.discipline] ?? dragging.discipline} showDisc />
        </div>
      )}

      {detail && <CardDetail c={detail} mentoriaId={mentoriaId} discName={discName[detail.discipline] ?? detail.discipline} onClose={() => setOpen(null)} onMove={move} />}
    </div>
  );
}

function CardFace({ c, discName, showDisc }: { c: BoardCard; discName: string; showDisc: boolean }) {
  return (
    <>
      <p className="flex items-center gap-1 font-mono text-[9.5px] tracking-[0.04em] text-muted uppercase">
        {showDisc && <span className="truncate">{discName}</span>}
        {c.priority >= 3 && <Flame className="size-3 shrink-0 text-orange-500" aria-label="mais cobrado" />}
      </p>
      <p className="mt-0.5 text-[13px] leading-snug font-medium text-ink">{c.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10.5px]">
        {c.list && (
          <span className="num flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-ink-2">
            <ListChecks className="size-3" /> {c.list.answered}/{c.list.total}
            {c.list.round > 1 && ` · ${c.list.round}ª`}
          </span>
        )}
        {c.retained > 0 && c.level < 4 && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger">retido {c.retained}x</span>}
        {c.hard && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger">dificuldade</span>}
        {c.level === 0 && c.scheduled && <span className="text-muted">{formatDate(c.scheduled)}</span>}
        {c.level === 4 && c.nextReview && (
          <span className="flex items-center gap-1 text-muted">
            <Clock className="size-3" /> revisão {formatDate(c.nextReview)}
          </span>
        )}
      </div>
    </>
  );
}

/** Detalhes do assunto: etapa, lista aberta, histórico das listas e o que o banco tem de cada nível. */
function CardDetail({
  c,
  mentoriaId,
  discName,
  onClose,
  onMove,
}: {
  c: BoardCard;
  mentoriaId: string;
  discName: string;
  onClose: () => void;
  onMove: (id: string, level: number) => Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  async function again() {
    setBusy('new');
    const r = await newListNow(c.id, mentoriaId).catch(() => ({ error: 'Sem conexão.' }));
    setBusy('');
    if (r.error) return toast.error(r.error);
    toast('Nova lista criada para o aluno.');
    router.refresh();
  }
  async function size(n: number) {
    setBusy(`s${n}`);
    const r = await setListSize(c.id, n, mentoriaId).catch(() => ({ error: 'Sem conexão.' }));
    setBusy('');
    if (r.error) return toast.error(r.error);
    toast(`Listas de ${c.title} com ${n} questões.`);
    router.refresh();
  }
  return (
    <Modal open onClose={onClose} title={c.title} size="md">
      <div className="space-y-5">
        <p className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
          {discName} · {c.block}
        </p>

        <div>
          <p className="mb-2 text-xs font-medium text-ink-2">Etapa</p>
          <div className="grid grid-cols-5 gap-1">
            {COLS.map((col) => (
              <button
                key={col.level}
                type="button"
                onClick={() => onMove(c.id, col.level)}
                aria-pressed={c.level === col.level}
                className={cn(
                  'rounded-md border px-1 py-2 text-[11px] font-medium transition',
                  c.level === col.level ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2',
                )}
              >
                {col.title}
              </button>
            ))}
          </div>
        </div>

        {c.level >= 1 && c.level <= 3 && (
          <div className="rounded-xl border border-line p-3.5">
            {c.list ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    Lista do {LEVELS[c.level].label}
                    {c.list.round > 1 && <span className="font-normal text-muted"> · {c.list.round}ª tentativa</span>}
                  </p>
                  <p className="num text-xs text-muted">
                    {c.list.answered}/{c.list.total} respondidas · criada em {formatDate(c.list.since)}
                    {c.list.off > 0 && ` · ${c.list.off} de outro nível (faltou no banco)`}
                  </p>
                </div>
                <Link href={`/listas/${c.list.id}`} className={buttonClass('secondary', 'sm')}>
                  Ver lista <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <p className="text-sm text-danger">O banco não tem questões deste assunto para o {LEVELS[c.level].label}.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-xs text-muted">Questões por lista</span>
              <span className="inline-flex items-center rounded-md border border-line p-0.5">
                {[5, 10, 15].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => size(n)}
                    aria-pressed={c.size === n}
                    className={cn('num h-7 min-w-8 rounded px-1.5 text-[11px] font-medium', c.size === n ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2')}
                  >
                    {busy === `s${n}` ? <Spinner className="size-3" /> : n}
                  </button>
                ))}
              </span>
              <Button size="sm" variant="ghost" onClick={again} disabled={Boolean(busy)} className="ml-auto">
                {busy === 'new' ? <Spinner /> : <RefreshCw className="size-3.5" />} Nova lista agora
              </Button>
            </div>
          </div>
        )}

        {c.level === 4 && (
          <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3.5 text-sm text-ink-2">
            <Trophy className="size-4 shrink-0 text-success" />
            Dominado{c.masteredOn ? ` em ${formatDate(c.masteredOn)}` : ''}.{' '}
            {c.hard ? 'Com dificuldade: volta toda semana nas listas da disciplina.' : 'Volta pelo menos 1 questão a cada 2 semanas.'}
            {c.nextReview && ` Próxima: ${formatDate(c.nextReview)}.`}
          </p>
        )}

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <Database className="size-3.5" /> Questões no banco
          </p>
          <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line text-center">
            {['Nível 1', 'Nível 2', 'Nível 3', 'Sem nível'].map((l, i) => {
              const n = c.bank[i === 3 ? 0 : i + 1];
              return (
                <div key={l} className="bg-surface px-1 py-2">
                  <p className={cn('num text-base font-medium', n < c.size && i < 3 ? 'text-warning' : 'text-ink')}>{n}</p>
                  <p className="font-mono text-[9.5px] text-muted uppercase">{l}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-ink-2">Listas feitas</p>
          {c.done.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {c.done.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className={cn('size-1.5 shrink-0 rounded-full', d.status === 'passed' ? 'bg-success' : d.status === 'failed' ? 'bg-danger' : 'bg-muted')} />
                  <span className="min-w-0 flex-1 text-ink-2">
                    {LEVELS[Math.min(4, d.level)]?.label} · {d.round}ª lista
                  </span>
                  <span className="num text-ink">{d.status === 'closed' ? 'fechada' : `${d.ok}/${d.total}`}</span>
                  <span className="num w-14 text-right text-muted">{formatDate(d.at)}</span>
                  <Link href={`/listas/${d.id}`} className="text-muted hover:text-ink" aria-label="Ver lista">
                    <ArrowRight className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Nenhuma lista feita ainda.</p>
          )}
          {c.retainedTotal > 0 && <p className="mt-2 text-[11px] text-muted">Ficou retido {c.retainedTotal} vez{c.retainedTotal > 1 ? 'es' : ''} na trilha.</p>}
        </div>
      </div>
    </Modal>
  );
}
