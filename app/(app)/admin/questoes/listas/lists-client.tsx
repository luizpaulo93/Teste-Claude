'use client';

import { BookOpenCheck, ClipboardCheck, Download, EyeOff, FileText, ImagePlus, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { Badge, Button, buttonClass, Card, Field, Input, Select } from '@/components/ui';
import { ActionButton, Modal, Spinner } from '@/components/ui-client';
import type { ListTemplate } from '@/lib/question-lists';
import { fetchFile, safeName, saveBlob } from '@/lib/download';
import { uploadFile } from '@/lib/storage/client';
import { cn } from '@/lib/utils';
import { AudiencePicker, type AudienceOptions } from '../../ao-vivo/lives-manager';
import { createSimuladoFromList, deleteList, deleteTemplate, lessonOptions, saveListAudience, saveListLessons, saveTemplate, setListResolution } from './actions';

export interface ListSummary {
  id: string;
  title: string;
  count: number;
  mode: 'lista' | 'teste';
  audience: string[];
  lesson_ids: string[];
  resolution_released?: boolean;
}

/** Baixar em PDF ou Word (com ou sem gabarito no fim). */
export function DownloadMenu({ id, title, small }: { id: string; title: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  const [busy, setBusy] = useState(false);
  async function get(fmt: 'pdf' | 'docx', gab: boolean) {
    setOpen(false);
    setBusy(true);
    toast('Gerando o arquivo…');
    try {
      const blob = await fetchFile(`/api/listas/${id}/arquivo?formato=${fmt}${gab ? '&gabarito=1' : ''}`, fmt);
      saveBlob(blob, safeName(`${title}${gab ? ' (com gabarito)' : ''}`, fmt));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o arquivo.');
    }
    setBusy(false);
  }
  const item = (fmt: 'pdf' | 'docx', gab: boolean) => (
    <button
      type="button"
      onClick={() => void get(fmt, gab)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-surface-2"
    >
      <FileText className={cn('size-4', fmt === 'pdf' ? 'text-danger' : 'text-brand')} /> {fmt === 'pdf' ? 'PDF' : 'Word'}
      {gab ? ' com gabarito' : ''}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={busy}>
        {busy ? <Spinner /> : <Download className="size-4" />} {small ? '' : 'Baixar'}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 rounded-xl border border-line-strong bg-surface p-1 shadow-2xl">
          {item('pdf', false)}
          {item('pdf', true)}
          {item('docx', false)}
          {item('docx', true)}
        </div>
      )}
    </div>
  );
}

export function ListCard({
  list,
  template,
  simulados,
  options,
}: {
  list: ListSummary;
  template: string;
  simulados: { id: string; title: string; is_published: boolean }[];
  options: AudienceOptions;
}) {
  const [apply, setApply] = useState(false);
  return (
    <Card className="space-y-2 p-3.5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/admin/questoes/listas/${list.id}`} className="block text-sm font-bold break-words text-ink hover:text-brand">
            {list.title}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge>{list.count} questões</Badge>
            <Badge tone={list.mode === 'teste' ? 'warning' : 'neutral'}>{list.mode === 'teste' ? 'Teste' : 'Lista'}</Badge>
            {list.mode === 'teste' && list.resolution_released && <Badge tone="success">Resolução liberada</Badge>}
            {template && <Badge className="max-w-full whitespace-normal">{template}</Badge>}
            {list.audience.length > 0 && <Badge tone="brand">Enviada a {list.audience.length}</Badge>}
            {list.lesson_ids.length > 0 && <Badge tone="brand">{list.lesson_ids.length} aula(s)</Badge>}
            {simulados.map((s) => (
              <Link key={s.id} href={`/admin/simulados/${s.id}`}>
                <Badge tone="success">Simulado{s.is_published ? '' : ' (rascunho)'}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/questoes/listas/${list.id}`} className={buttonClass('secondary', 'sm')}>
          <Pencil className="size-4" /> Editar
        </Link>
        <DownloadMenu id={list.id} title={list.title} />
        <Button size="sm" onClick={() => setApply(true)}>
          <Send className="size-4" /> Aplicar
        </Button>
        {list.mode === 'teste' && (
          <ActionButton
            action={() => setListResolution(list.id, !list.resolution_released)}
            confirm={list.resolution_released ? undefined : 'Liberar a resolução? Quem já finalizou o teste passa a ver a resolução de cada questão e pode baixar o PDF com as resoluções.'}
            success={list.resolution_released ? 'Resolução escondida' : 'Resolução liberada'}
            variant={list.resolution_released ? 'ghost' : 'secondary'}
            size="sm"
          >
            {list.resolution_released ? <EyeOff className="size-4" /> : <BookOpenCheck className="size-4" />}{' '}
            {list.resolution_released ? 'Esconder resolução' : 'Liberar resolução'}
          </ActionButton>
        )}
        <span className="ml-auto">
          <ActionButton
            action={() => deleteList(list.id)}
            confirm="Excluir esta lista? Ela some de onde foi aplicada (turmas, aulas). As questões continuam no banco."
            success="Lista excluída"
            variant="ghost"
            size="sm"
            className="size-8 px-0 hover:text-danger"
            title="Excluir lista"
          >
            <Trash2 className="size-3.5" />
          </ActionButton>
        </span>
      </div>
      {apply && <ApplyModal list={list} options={options} simulados={simulados} onClose={() => setApply(false)} />}
    </Card>
  );
}

/** Aplicar a lista: turmas/mentorias/alunos (lista ou teste), aulas, ou criar um simulado. */
export function ApplyModal({
  list,
  options,
  simulados,
  onClose,
}: {
  list: ListSummary;
  options: AudienceOptions;
  simulados: { id: string; title: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'turmas' | 'aulas' | 'simulado'>('turmas');
  const [mode, setMode] = useState(list.mode);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [lessons, setLessons] = useState<{ id: string; title: string; folder: string }[] | null>(null);
  const [picked, setPicked] = useState<string[]>(list.lesson_ids);
  const [q, setQ] = useState('');
  const [simTitle, setSimTitle] = useState(list.title);
  const [minutes, setMinutes] = useState('0');

  useEffect(() => {
    if (tab === 'aulas' && !lessons)
      lessonOptions()
        .then(setLessons)
        .catch(() => setLessons([]));
  }, [tab, lessons]);

  async function save() {
    setBusy(true);
    try {
      if (tab === 'turmas') {
        const aud = new FormData(form.current!).getAll('audience').map(String);
        await saveListAudience(list.id, aud, mode);
        toast(aud.length ? 'Lista enviada' : 'Lista tirada de todos');
      } else if (tab === 'aulas') {
        await saveListLessons(list.id, picked);
        toast(picked.length ? `Lista em ${picked.length} aula(s)` : 'Lista tirada das aulas');
      } else {
        const r = await createSimuladoFromList(list.id, { title: simTitle, minutes: Number(minutes) || 0 });
        if ('error' in r && r.error) return toast.error(r.error);
        toast(`Simulado criado como rascunho${'skipped' in r && r.skipped ? ` (${r.skipped} anulada(s) ficaram de fora)` : ''}`);
        onClose();
        router.push(`/admin/simulados/${'id' in r ? r.id : ''}`);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      toast.error('Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  const term = q.trim().toLowerCase();
  const shown = (lessons ?? []).filter((l) => !term || `${l.title} ${l.folder}`.toLowerCase().includes(term)).slice(0, 80);
  const tabs = [
    { key: 'turmas', label: 'Turmas e alunos' },
    { key: 'aulas', label: 'Aulas' },
    { key: 'simulado', label: 'Simulado' },
  ] as const;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Aplicar: ${list.title}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Spinner />} {tab === 'simulado' ? 'Criar simulado' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn('rounded-lg px-2 py-2 text-xs font-semibold transition', tab === t.key ? 'bg-surface text-ink shadow' : 'text-muted')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form ref={form} onSubmit={(e) => e.preventDefault()} className={cn('space-y-3', tab !== 'turmas' && 'hidden')}>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['lista', 'Lista', 'Correção na hora'],
                ['teste', 'Teste', 'Resultado no fim'],
              ] as const
            ).map(([k, l, d]) => (
              <button
                key={k}
                type="button"
                aria-pressed={mode === k}
                onClick={() => setMode(k)}
                className={cn('rounded-xl border p-3 text-left', mode === k ? 'border-brand bg-brand/8' : 'border-line')}
              >
                <span className="block text-sm font-bold text-ink">{l}</span>
                <span className="block text-[11px] text-muted">{d}</span>
              </button>
            ))}
          </div>
          <AudiencePicker options={options} initial={list.audience} title="Quem recebe" empty="Ninguém ainda (escolha turmas, mentorias ou alunos)." />
        </form>

        {tab === 'aulas' && (
          <div className="space-y-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aula" aria-label="Buscar aula" />
            {!lessons ? (
              <Spinner />
            ) : (
              <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {shown.map((l) => (
                  <li key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-ink">
                      <input
                        type="checkbox"
                        checked={picked.includes(l.id)}
                        onChange={() => setPicked((p) => (p.includes(l.id) ? p.filter((x) => x !== l.id) : [...p, l.id]))}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {l.title}
                        {l.folder && <span className="text-muted"> · {l.folder}</span>}
                      </span>
                    </label>
                  </li>
                ))}
                {!shown.length && <li className="px-3 py-4 text-center text-xs text-muted">Nenhuma aula encontrada.</li>}
              </ul>
            )}
            <p className="text-[11px] text-muted">{picked.length} aula(s) escolhida(s). A lista aparece na tela da aula.</p>
          </div>
        )}

        {tab === 'simulado' && (
          <div className="space-y-3">
            <Field label="Nome do simulado">
              <Input value={simTitle} onChange={(e) => setSimTitle(e.target.value)} />
            </Field>
            <Field label="Tempo (minutos, 0 = sem limite)">
              <Input type="number" min={0} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
            <p className="text-xs text-muted">
              O simulado nasce como rascunho com o PDF e o gabarito da lista. Se você editar a lista antes de alguém responder, o simulado é atualizado junto.
            </p>
            {simulados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {simulados.map((s) => (
                  <Link key={s.id} href={`/admin/simulados/${s.id}`} className="flex items-center gap-1 text-xs font-semibold text-brand">
                    <ClipboardCheck className="size-3.5" /> {s.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- cabeçalhos e rodapés
const dims = (url: string) =>
  new Promise<{ w: number; h: number }>((ok) => {
    const i = new Image();
    i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => ok({ w: 0, h: 0 });
    i.src = url;
  });

function ImageSlot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { url: string; w: number; h: number };
  onChange: (v: { url: string; w: number; h: number }) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const r = await uploadFile('media', 'listas/modelos', f);
      onChange({ url: r.publicUrl, ...(await dims(URL.createObjectURL(f))) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no envio.');
    }
    setBusy(false);
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-ink-2">{label}</p>
      {value.url ? (
        <div className="relative rounded-xl border border-line bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="" className="block h-auto w-full" />
          <button
            type="button"
            onClick={() => onChange({ url: '', w: 0, h: 0 })}
            aria-label={`Tirar ${label.toLowerCase()}`}
            className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/70 text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-4 text-sm font-semibold text-ink-2 hover:bg-surface-2"
        >
          {busy ? <Spinner /> : <ImagePlus className="size-4" />} Escolher imagem
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label={label} onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

function TemplateModal({ t, onClose }: { t: ListTemplate | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(t?.name ?? '');
  const [header, setHeader] = useState({ url: t?.header_url ?? '', w: t?.header_w ?? 0, h: t?.header_h ?? 0 });
  const [footer, setFooter] = useState({ url: t?.footer_url ?? '', w: t?.footer_w ?? 0, h: t?.footer_h ?? 0 });
  const [rest, setRest] = useState({ url: t?.header_rest_url ?? '', w: t?.header_rest_w ?? 0, h: t?.header_rest_h ?? 0 });
  const [all, setAll] = useState(Boolean(t?.header_all));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await saveTemplate({
      id: t?.id,
      name,
      header_url: header.url,
      header_w: header.w,
      header_h: header.h,
      footer_url: footer.url,
      footer_w: footer.w,
      footer_h: footer.h,
      header_rest_url: rest.url,
      header_rest_w: rest.w,
      header_rest_h: rest.h,
      header_all: all,
    }).catch(() => ({ error: 'Não foi possível salvar.' }));
    setBusy(false);
    if ('error' in r && r.error) return toast.error(r.error);
    toast('Modelo salvo');
    onClose();
    router.refresh();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t ? 'Editar modelo' : 'Novo modelo'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Spinner />} Salvar modelo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome do modelo">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Simulado Vértice" aria-label="Nome do modelo" />
        </Field>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              [false, '1ª página e demais'],
              [true, 'Um só para todas'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={l}
              type="button"
              aria-pressed={all === v}
              onClick={() => setAll(v)}
              className={cn('rounded-lg px-2 py-2 text-xs font-semibold transition', all === v ? 'bg-surface text-ink shadow' : 'text-muted')}
            >
              {l}
            </button>
          ))}
        </div>
        <ImageSlot label={all ? 'Cabeçalho (todas as páginas)' : 'Cabeçalho (1ª página)'} value={header} onChange={setHeader} />
        {!all && <ImageSlot label="Cabeçalho das outras páginas (opcional)" value={rest} onChange={setRest} />}
        <ImageSlot label="Rodapé (todas as páginas)" value={footer} onChange={setFooter} />
        <p className="text-[11px] text-muted">As imagens ocupam a largura da folha. Use imagens largas (ex.: 1600 × 250 px).</p>
      </div>
    </Modal>
  );
}

export function TemplatesManager({ templates }: { templates: ListTemplate[] }) {
  const [edit, setEdit] = useState<ListTemplate | 'new' | null>(null);
  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <Card key={t.id} className="flex items-center gap-3 p-3">
          <div className="grid w-28 shrink-0 gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.header_url ? <img src={t.header_url} alt="" className="h-auto w-full rounded bg-white" /> : <span className="h-3 rounded bg-surface-3" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.footer_url ? <img src={t.footer_url} alt="" className="h-auto w-full rounded bg-white" /> : <span className="h-2 rounded bg-surface-3" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold break-words text-ink">{t.name}</p>
          </div>
          <button type="button" onClick={() => setEdit(t)} aria-label="Editar modelo" className={buttonClass('ghost', 'icon', 'size-8')}>
            <Pencil className="size-3.5" />
          </button>
          <ActionButton
            action={() => deleteTemplate(t.id)}
            confirm="Excluir este modelo? As listas que o usam ficam sem cabeçalho e rodapé."
            success="Modelo excluído"
            variant="ghost"
            size="sm"
            className="size-8 px-0 hover:text-danger"
            title="Excluir modelo"
          >
            <Trash2 className="size-3.5" />
          </ActionButton>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setEdit('new')} className="w-full">
        <Plus className="size-4" /> Novo modelo de cabeçalho e rodapé
      </Button>
      {edit && <TemplateModal t={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

/** Seleção do modelo pelo nome (no montador). */
export function TemplateSelect({ templates, value, onChange }: { templates: ListTemplate[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Cabeçalho e rodapé" className="min-w-0">
      <option value="">Sem cabeçalho (só o título)</option>
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}
