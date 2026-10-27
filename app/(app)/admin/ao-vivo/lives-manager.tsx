'use client';

import { CircleStop, ExternalLink, Info, Pencil, Plus, Radio, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { ImageUpload } from '@/components/admin/uploads';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, buttonClass } from '@/components/ui';
import { ActionButton, Modal, SubmitButton, Switch } from '@/components/ui-client';
import type { Course, LiveSession } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { deleteLive, saveLive, setLiveStatus } from '../live-actions';

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

export function LivesManager({ lives, courses }: { lives: LiveSession[]; courses: Pick<Course, 'id' | 'title'>[] }) {
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
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {l.status === 'live' && (
                        <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          <span className="size-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
                        </span>
                      )}
                      {l.status === 'scheduled' && <Badge tone="brand">Agendada</Badge>}
                      {l.status === 'ended' && <Badge>Encerrada</Badge>}
                      {!l.is_published && <Badge tone="warning">Oculta</Badge>}
                      {!l.youtube_id && <Badge tone="danger">Sem link do YouTube</Badge>}
                    </div>
                    <p className="mt-1.5 font-bold text-ink">{l.title}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(l.starts_at)} · {courseName(l.course_id)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
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

      <Card className="p-5 xl:sticky xl:top-6 xl:self-start">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <Info className="size-4 text-brand" /> Como transmitir
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-ink-2">
          <li>
            No YouTube Studio, crie a transmissão com visibilidade <strong className="text-ink">Não listado</strong>.
          </li>
          <li>
            Em configurações, deixe <strong className="text-ink">Permitir incorporação</strong> ligado e “Conteúdo para crianças” desligado.
          </li>
          <li>Copie o link da live e cole aqui ao agendar.</li>
          <li>
            Na hora, clique em <strong className="text-ink">Iniciar</strong> — a live aparece para os alunos na hora, com chat.
          </li>
          <li>
            Ao terminar, clique em <strong className="text-ink">Encerrar</strong>. Se “Mostrar gravação” estiver ligado, ela vira replay.
          </li>
        </ol>
      </Card>

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
              <span className="text-xs font-semibold text-ink-2">Capa (opcional, vertical 3:4)</span>
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
