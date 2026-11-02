'use client';

import { CheckCircle2, CircleStop, ExternalLink, Pencil, Plus, Radio, RotateCcw, Trash2, MonitorPlay, Video, X, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload, PdfDrop } from '@/components/admin/uploads';
import { LiveMaterialsAdmin } from '@/components/live/live-materials';
import { YoutubeGuide } from './youtube-guide';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import type { Course, LessonMaterial, LiveSession } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { deleteLive, disconnectYoutube, saveLive, setLiveStatus } from '../live-actions';

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function tzOffset() {
  const m = -new Date().getTimezoneOffset();
  const a = Math.abs(m);
  return `${m >= 0 ? '+' : '-'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export interface YoutubeState {
  oauth: boolean;
  channel: string;
  notice?: string;
  /** endereço do site (para as URLs do tutorial) */
  origin: string;
}

export function LivesManager({
  lives,
  courses,
  yt,
  spaces,
  options,
}: {
  lives: (LiveSession & { space?: string | null })[];
  options: AudienceOptions;
  courses: Pick<Course, 'id' | 'title'>[];
  yt: YoutubeState;
  /** mentorias (grupos e individuais) que podem ter live só para elas */
  spaces: { key: string; label: string }[];
}) {
  const [edit, setEdit] = useState<{ live?: LiveSession } | null>(null);
  const [pdfs, setPdfs] = useState<string | null>(null);
  const pdfLive = lives.find((l) => l.id === pdfs);
  const courseName = (id: string | null) => (id ? courses.find((c) => c.id === id)?.title ?? 'Curso removido' : 'Todos os alunos liberados');
  const all = [...options.classes, ...options.mentorias, ...options.students, ...options.courses];
  const audience = (l: LiveSession) =>
    l.audience?.length
      ? l.audience.map((t) => all.find((x) => x.key === t)?.label ?? 'removido').join(', ')
      : l.space
        ? `Mentoria: ${spaces.find((x) => x.key === l.space)?.label ?? 'removida'}`
        : courseName(l.course_id);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <GoLiveButton options={options} />
          <Button variant="secondary" onClick={() => setEdit({})}>
            <Plus className="size-4" /> Agendar transmissão
          </Button>
        </div>
        {lives.length ? (
          <div className="space-y-3">
            {lives.map((l) => (
              <Card key={l.id} className={l.status === 'live' ? 'border-red-500/50 p-4' : 'p-4'}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 basis-full sm:basis-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {l.status === 'live' && (
                        <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
                        </span>
                      )}
                      {l.status === 'scheduled' && <Badge tone="brand">Agendada</Badge>}
                      {l.status === 'ended' && <Badge>Encerrada</Badge>}
                      {!l.is_published && <Badge tone="warning">Oculta</Badge>}
                      {!l.youtube_id && !yt.channel && <Badge tone="danger">Sem link do YouTube</Badge>}
                    </div>
                    <p className="mt-1.5 font-bold text-ink">{l.title}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(l.starts_at)} · {audience(l)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {l.status !== 'ended' && (
                      <Link href={`/admin/ao-vivo/${l.id}/estudio`} className={buttonClass('primary', 'sm')}>
                        <Video className="size-3.5" /> Estúdio
                      </Link>
                    )}
                    {l.status === 'live' && (
                      <ActionButton action={() => setLiveStatus(l.id, 'ended')} confirm="Encerrar a transmissão?" success="Transmissão encerrada" size="sm">
                        <CircleStop className="size-3.5" /> Encerrar
                      </ActionButton>
                    )}
                    {l.status === 'ended' && (
                      <ActionButton action={() => setLiveStatus(l.id, 'scheduled')} success="Voltou para agendada" size="sm" variant="ghost" title="Voltar para agendada">
                        <RotateCcw className="size-3.5" />
                      </ActionButton>
                    )}
                    <Link href={`/ao-vivo/${l.id}`} target="_blank" className={buttonClass('ghost', 'sm', 'px-2')} aria-label="Abrir sala">
                      <ExternalLink className="size-4" />
                    </Link>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => setPdfs(l.id)} aria-label="PDFs da live" title="PDFs da live">
                      <FileText className="size-4" />
                      {(l.materials?.length ?? 0) > 0 && <span className="text-[11px]">{l.materials!.length}</span>}
                    </Button>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => setEdit({ live: l })} aria-label="Editar">
                      <Pencil className="size-4" />
                    </Button>
                    <ActionButton action={() => deleteLive(l.id)} confirm="Excluir esta transmissão e o chat?" success="Excluída" variant="ghost" size="sm" className="px-2 hover:text-danger" title="Excluir">
                      <Trash2 className="size-4" />
                    </ActionButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Radio className="size-6" />} title="Nenhuma transmissão" description="Agende um aulão e cole o link da live do YouTube." />
        )}
      </div>

      <YoutubeCard yt={yt} />

      <Modal open={Boolean(pdfLive)} onClose={() => setPdfs(null)} title={`PDFs · ${pdfLive?.title ?? ''}`} size="md">
        {pdfLive && (
          <div className="space-y-2">
            <LiveMaterialsAdmin liveId={pdfLive.id} materials={pdfLive.materials ?? []} />
            <p className="text-[11px] text-muted">Os PDFs aparecem na sala da live e na aula salva no banco de aulas.</p>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.live ? 'Editar transmissão' : 'Agendar transmissão'} size="lg">
        {edit && (
          <LiveForm live={edit.live} options={options} onDone={() => setEdit(null)} />
        )}
      </Modal>
    </div>
  );
}

/**
 * Formulário da live: nome, capa, PDFs e turmas. O chat é sempre ligado e o link do YouTube é criado
 * pelo Estúdio. now = "Fazer transmissão": começa agora e já abre o Estúdio.
 */
export function LiveForm({ live, options, onDone, now = false }: { live?: LiveSession; options: AudienceOptions; onDone?: () => void; now?: boolean }) {
  const router = useRouter();
  return (
    <ActionForm
      action={saveLive}
      success={now ? 'Abrindo o Estúdio…' : 'Transmissão salva'}
      onSuccess={(r) => {
        onDone?.();
        if (now && r.id) router.push(`/admin/ao-vivo/${r.id}/estudio`);
      }}
      className="space-y-4"
    >
      {live && <input type="hidden" name="id" value={live.id} />}
      <input type="hidden" name="tz_offset" value={tzOffset()} />
      <input type="hidden" name="chat_enabled" value="on" />
      <input type="hidden" name="show_replay" value="on" />
      <input type="hidden" name="is_published" value="on" />
      <Field label="Nome da transmissão">
        <Input name="title" defaultValue={live?.title} required maxLength={160} placeholder="Ex.: Aulão de Física — Leis de Newton" autoFocus />
      </Field>
      {now ? (
        <input type="hidden" name="starts_at" value={toLocalInput(new Date().toISOString())} />
      ) : (
        <Field label="Data e hora">
          <Input name="starts_at" type="datetime-local" defaultValue={toLocalInput(live?.starts_at)} required />
        </Field>
      )}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-ink-2">Capa (3:4)</span>
        <ImageUpload name="cover_url" defaultValue={live?.cover_url} folder="lives" aspect="aspect-[3/4] max-w-40" />
      </div>
      <FormPdfs initial={live?.materials ?? []} />
      <AudiencePicker
        options={options}
        initial={live?.audience?.length ? live.audience : live?.space ? [live.space] : live?.course_id ? [`course:${live.course_id}`] : []}
      />
      <Field label="Descrição (opcional)">
        <Textarea name="description" defaultValue={live?.description} rows={2} maxLength={2000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{now ? 'Ir para o Estúdio' : 'Salvar'}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Botão "Fazer transmissão": nome, capa, PDFs e turmas, e já abre o Estúdio. */
export function GoLiveButton({ options }: { options: AudienceOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="!bg-red-600 hover:!bg-red-700">
        <Radio className="size-4" /> Fazer transmissão
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Fazer transmissão" size="lg">
        {open && <LiveForm options={options} now onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

export interface AudienceOptions {
  classes: { key: string; label: string; courseIds?: string[]; all?: boolean }[];
  mentorias: { key: string; label: string }[];
  students: { key: string; label: string; sub?: string }[];
  courses: { key: string; label: string }[];
}

/** Quem assiste: turmas, alunos, mentorias (individual ou grupo) e cursos. Nada marcado = todos os alunos liberados. */
function AudiencePicker({ options, initial }: { options: AudienceOptions; initial: string[] }) {
  // Lives antigas com "turmas com acesso ao curso": viram as turmas que têm o curso
  const [sel, setSel] = useState<string[]>(() => [
    ...new Set(
      initial.flatMap((t) =>
        t.startsWith('course:') ? options.classes.filter((c) => c.all || c.courseIds?.includes(t.slice(7))).map((c) => c.key) : [t],
      ),
    ),
  ]);
  const [q, setQ] = useState('');
  const all = [...options.classes, ...options.mentorias, ...options.students, ...options.courses];
  const toggle = (k: string) => setSel((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
  const term = q.trim().toLowerCase();
  const found = term ? options.students.filter((x) => `${x.label} ${x.sub ?? ''}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const Chips = ({ title, list }: { title: string; list: { key: string; label: string }[] }) =>
    list.length ? (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted">{title}</p>
        <div className="flex flex-wrap gap-1.5">
          {list.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={sel.includes(x.key)}
              onClick={() => toggle(x.key)}
              className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold transition', sel.includes(x.key) ? 'border-brand bg-brand text-white' : 'border-line text-ink-2 hover:bg-surface-2')}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
    ) : null;
  return (
    <div className="space-y-3 rounded-2xl border border-line p-3.5">
      {sel.map((k) => (
        <input key={k} type="hidden" name="audience" value={k} />
      ))}
      <div>
        <p className="text-xs font-semibold text-ink-2">Quem pode assistir</p>
        <p className="text-[11px] text-muted">
          {sel.length ? `${sel.length} escolhido${sel.length > 1 ? 's' : ''}: ${sel.map((k) => all.find((x) => x.key === k)?.label ?? k).join(', ')}` : 'Todos os alunos liberados (escolha abaixo para limitar).'}
        </p>
      </div>
      <Chips title="Turmas" list={options.classes} />
      <Chips title="Mentorias (individual ou em grupo)" list={options.mentorias} />
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted">Alunos</p>
        <div className="flex flex-wrap gap-1.5">
          {sel
            .filter((k) => k.startsWith('u:'))
            .map((k) => (
              <button key={k} type="button" onClick={() => toggle(k)} className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                {all.find((x) => x.key === k)?.label ?? k.slice(2)} <X className="size-3" />
              </button>
            ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno por nome ou e-mail" aria-label="Buscar aluno" className="h-9" />
        {found.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {found.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => { toggle(x.key); setQ(''); }} className="w-full px-3 py-2 text-left text-xs hover:bg-surface-2">
                  <span className="font-semibold text-ink">{x.label}</span> <span className="text-muted">{x.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** PDFs da live no formulário: os alunos abrem e baixam na sala durante a transmissão (e na aula salva depois). */
function FormPdfs({ initial }: { initial: LessonMaterial[] }) {
  const [list, setList] = useState(initial);
  return (
    <div className="space-y-2">
      <input type="hidden" name="materials" value={JSON.stringify(list)} />
      <span className="text-xs font-semibold text-ink-2">PDFs para os alunos baixarem durante a live</span>
      {list.map((m) => (
        <div key={m.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2">
          <FileText className="size-4 shrink-0 text-danger" />
          <Input
            value={m.title}
            onChange={(e) => setList((l) => l.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
            className="h-8 flex-1 border-0 bg-transparent px-1"
            aria-label="Nome do PDF"
          />
          <span className="shrink-0 text-[10px] text-muted">{m.size_label}</span>
          <button type="button" onClick={() => setList((l) => l.filter((x) => x.id !== m.id))} aria-label="Tirar PDF" className="text-muted hover:text-danger">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <PdfDrop folder="lives/pdfs" multiple label="Subir PDF" onUploaded={(r) => setList((l) => [...l, { id: crypto.randomUUID().slice(0, 12), title: r.title, file_path: r.path, size_label: r.size }])} />
    </div>
  );
}

/** Conta do YouTube: conectar (cria a live no canal sozinho) ou usar a chave HLS. */
function YoutubeCard({ yt }: { yt: YoutubeState }) {
  return (
    <Card className="order-first space-y-4 p-5 xl:sticky xl:top-6 xl:order-none xl:self-start">
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <MonitorPlay className="size-4 text-red-500" /> YouTube
      </p>
      {yt.notice && <p className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">{yt.notice}</p>}
      {yt.channel ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-ink">
            <CheckCircle2 className="size-4 text-success" /> Conectado: <strong className="truncate">{yt.channel}</strong>
          </p>
          <p className="text-xs text-muted">No Estúdio, o app cria a live não listada no seu canal e transmite com a câmera e o microfone que você escolher.</p>
          <ActionButton action={disconnectYoutube} confirm="Desconectar a conta do YouTube?" success="Conta desconectada" size="sm" variant="ghost">
            Desconectar
          </ActionButton>
        </div>
      ) : (
        <a href="/api/youtube/connect" className={buttonClass('primary', 'md', 'w-full !bg-red-600 hover:!bg-red-700')}>
          <MonitorPlay className="size-4" /> Conectar conta do YouTube
        </a>
      )}
      {!yt.channel && <p className="text-xs text-muted">Conecte uma vez. No Estúdio, a live é criada no seu canal e, ao encerrar, o link vira aula na pasta “Live”.</p>}
      {!yt.channel && <YoutubeGuide origin={yt.origin} open={!yt.oauth} />}
    </Card>
  );
}
