'use client';

import { CheckCircle2, CircleStop, ExternalLink, FolderPlus, KeyRound, Pencil, Plus, Radio, RotateCcw, Trash2, MonitorPlay, Video } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload } from '@/components/admin/uploads';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import type { Course, LiveSession } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { deleteLive, disconnectYoutube, saveLive, saveLiveAsLesson, saveYoutubeKey, setLiveStatus } from '../live-actions';
import { toast } from '@/components/toast';

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
  hasKey: boolean;
  notice?: string;
}

export function LivesManager({ lives, courses, yt }: { lives: LiveSession[]; courses: Pick<Course, 'id' | 'title'>[]; yt: YoutubeState }) {
  const [edit, setEdit] = useState<{ live?: LiveSession } | null>(null);
  const courseName = (id: string | null) => (id ? courses.find((c) => c.id === id)?.title ?? 'Curso removido' : 'Todos os alunos liberados');

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
                      {formatDateTime(l.starts_at)} · {courseName(l.course_id)}
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
                    {l.status === 'ended' && l.youtube_id && (
                      <ActionButton action={() => saveLiveAsLesson(l.id)} success='Salva na pasta "Lives" do banco de aulas' variant="ghost" size="sm" className="px-2" title="Salvar como aula (pasta Lives)">
                        <FolderPlus className="size-4" />
                      </ActionButton>
                    )}
                    <Link href={`/ao-vivo/${l.id}`} target="_blank" className={buttonClass('ghost', 'sm', 'px-2')} aria-label="Abrir sala">
                      <ExternalLink className="size-4" />
                    </Link>
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

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.live ? 'Editar transmissão' : 'Agendar transmissão'} size="lg">
        {edit && (
          <ActionForm action={saveLive} success="Transmissão salva" onSuccess={() => setEdit(null)} className="space-y-4">
            {edit.live && <input type="hidden" name="id" value={edit.live.id} />}
            <input type="hidden" name="tz_offset" value={tzOffset()} />
            <Field label="Título">
              <Input name="title" defaultValue={edit.live?.title} required maxLength={160} placeholder="Ex.: Aulão de Física — Leis de Newton" autoFocus />
            </Field>
            <Field label="Link da transmissão no YouTube" hint="Ex.: https://youtube.com/live/… ou https://youtu.be/… (pode deixar para depois)">
              <Input name="youtube" defaultValue={edit.live?.youtube_id ? `https://youtu.be/${edit.live.youtube_id}` : ''} placeholder="https://youtube.com/live/..." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Data e hora">
                <Input name="starts_at" type="datetime-local" defaultValue={toLocalInput(edit.live?.starts_at)} required />
              </Field>
              <Field label="Quem pode assistir">
                <Select name="course_id" defaultValue={edit.live?.course_id ?? ''}>
                  <option value="">Todos os alunos liberados</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Turmas com acesso a: {c.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Descrição">
              <Textarea name="description" defaultValue={edit.live?.description} rows={3} maxLength={2000} />
            </Field>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-ink-2">Capa (3:4)</span>
              <ImageUpload name="cover_url" defaultValue={edit.live?.cover_url} folder="lives" aspect="aspect-[3/4] max-w-40" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Switch name="chat_enabled" defaultChecked={edit.live?.chat_enabled ?? true} label="Chat" />
              <Switch name="show_replay" defaultChecked={edit.live?.show_replay ?? true} label="Mostrar gravação" />
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

/** Conta do YouTube: conectar (cria a live no canal sozinho) ou usar a chave HLS. */
function YoutubeCard({ yt }: { yt: YoutubeState }) {
  const [key, setKey] = useState('');
  const [pending, start] = useTransition();
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
      ) : yt.oauth ? (
        <a href="/api/youtube/connect" className={buttonClass('primary', 'md', 'w-full !bg-red-600 hover:!bg-red-700')}>
          <MonitorPlay className="size-4" /> Conectar conta do YouTube
        </a>
      ) : null}
      {!yt.channel && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-2">
            <KeyRound className="size-3.5" /> Chave da transmissão (HLS) {yt.hasKey && <Badge tone="success">salva</Badge>}
          </p>
          <p className="text-[11px] text-muted">YouTube Studio → Transmitir → Configurações da transmissão → Protocolo HLS. Copie a URL ou a chave.</p>
          <div className="flex gap-2">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={yt.hasKey ? '••••••••' : 'Cole aqui'} type="password" autoComplete="off" className="min-w-0 flex-1" />
            <Button
              disabled={pending || !key}
              onClick={() =>
                start(async () => {
                  const r = await saveYoutubeKey(key);
                  if (r.error) toast.error(r.error);
                  else {
                    toast('Chave salva');
                    setKey('');
                  }
                })
              }
            >
              Salvar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
