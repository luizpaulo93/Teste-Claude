'use client';

import { CheckCircle2, CircleStop, ExternalLink, Pencil, Plus, Radio, RotateCcw, Trash2, MonitorPlay, Video, X, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload } from '@/components/admin/uploads';
import { LiveMaterialsAdmin } from '@/components/live/live-materials';
import { YoutubeGuide } from './youtube-guide';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import type { Course, LiveSession } from '@/lib/types';
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
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setEdit({})}>
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
                    {l.status !== 'live' && (
                      <ActionButton action={() => setLiveStatus(l.id, 'live')} confirm="Iniciar agora? Os alunos verão a transmissão." success="Transmissão no ar!" variant="primary" size="sm" className="!bg-red-600 hover:!bg-red-700">
                        <Radio className="size-3.5" /> {l.status === 'ended' ? 'Reabrir' : 'Iniciar'}
                      </ActionButton>
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
          <ActionForm action={saveLive} success="Transmissão salva" onSuccess={() => setEdit(null)} className="space-y-4">
            {edit.live && <input type="hidden" name="id" value={edit.live.id} />}
            <input type="hidden" name="tz_offset" value={tzOffset()} />
            <Field label="Título">
              <Input name="title" defaultValue={edit.live?.title} required maxLength={160} placeholder="Ex.: Aulão de Física — Leis de Newton" autoFocus />
            </Field>
            <Field label="Link do YouTube (opcional)" hint="Com a conta conectada, o Estúdio preenche sozinho.">
              <Input name="youtube" defaultValue={edit.live?.youtube_id ? `https://youtu.be/${edit.live.youtube_id}` : ''} placeholder="https://youtube.com/live/..." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data e hora">
                <Input name="starts_at" type="datetime-local" defaultValue={toLocalInput(edit.live?.starts_at)} required />
              </Field>
            </div>
            <AudiencePicker options={options} initial={edit.live?.audience?.length ? edit.live.audience : edit.live?.space ? [edit.live.space] : edit.live?.course_id ? [`course:${edit.live.course_id}`] : []} />
            <Field label="Descrição">
              <Textarea name="description" defaultValue={edit.live?.description} rows={3} maxLength={2000} />
            </Field>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-ink-2">Capa (3:4)</span>
              <ImageUpload name="cover_url" defaultValue={edit.live?.cover_url} folder="lives" aspect="aspect-[3/4] max-w-40" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Switch name="chat_enabled" defaultChecked={edit.live?.chat_enabled ?? true} label="Chat" />
              <input type="hidden" name="show_replay" value="on" />
              <Switch name="is_published" defaultChecked={edit.live?.is_published ?? true} label="Visível" />
            </div>
            <div className="flex justify-end">
              <SubmitButton>Salvar</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>
    </div>
  );
}

export interface AudienceOptions {
  classes: { key: string; label: string }[];
  mentorias: { key: string; label: string }[];
  students: { key: string; label: string; sub?: string }[];
  courses: { key: string; label: string }[];
}

/** Quem assiste: turmas, alunos, mentorias (individual ou grupo) e cursos. Nada marcado = todos os alunos liberados. */
function AudiencePicker({ options, initial }: { options: AudienceOptions; initial: string[] }) {
  const [sel, setSel] = useState<string[]>(initial);
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
      <Chips title="Turmas com acesso ao curso" list={options.courses} />
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
      {!yt.channel && <p className="text-xs text-muted">Conecte uma vez. No Estúdio, a live é criada no seu canal e, ao encerrar, o link vira aula na pasta “Lives”.</p>}
      {!yt.channel && <YoutubeGuide origin={yt.origin} open={!yt.oauth} />}
    </Card>
  );
}
