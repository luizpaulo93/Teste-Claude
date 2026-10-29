'use client';

import { CalendarClock, Check, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { MeetingForm } from '@/components/admin/meeting-form';
import { Badge, Button, buttonClass, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { ActionButton, Modal, SubmitButton } from '@/components/ui-client';
import { TASK_KINDS, type Mentoria, type MentoriaCheckin, type MentoriaMeeting, type MentoriaTask } from '@/lib/types';
import { addDays, cn, formatDate, formatDateTime } from '@/lib/utils';
import { copyWeek, deleteMeeting, deleteMentoria, deleteTask, saveFeedback, saveTask } from '../../misc-actions';
import { MentoriaForm } from '../mentoria-form';

export function MentoriaDetail({
  mentoria,
  week,
  tasks,
  checkins,
  meetings,
}: {
  mentoria: Mentoria;
  week: string;
  tasks: MentoriaTask[];
  checkins: MentoriaCheckin[];
  meetings: MentoriaMeeting[];
}) {
  const router = useRouter();
  const [task, setTask] = useState<{ t?: MentoriaTask } | null>(null);
  const [meeting, setMeeting] = useState<{ m?: MentoriaMeeting } | null>(null);
  const [editing, setEditing] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-6">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">Tarefas da semana</p>
              <p className="text-xs text-muted">
                {formatDate(week)} – {formatDate(addDays(week, 6))}
              </p>
            </div>
            <div className="flex gap-1">
              <Link href={`?w=${addDays(week, -7)}`} scroll={false} className={buttonClass('secondary', 'icon', 'size-9')} aria-label="Semana anterior">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={`?w=${addDays(week, 7)}`} scroll={false} className={buttonClass('secondary', 'icon', 'size-9')} aria-label="Próxima semana">
                <ChevronRight className="size-4" />
              </Link>
              <ActionButton action={() => copyWeek(mentoria.id, addDays(week, -7), week)} success="Tarefas copiadas" size="sm" className="h-9" title="Copiar da semana anterior">
                <Copy className="size-3.5" /> <span className="hidden sm:inline">Copiar anterior</span>
              </ActionButton>
              <Button size="sm" className="h-9" onClick={() => setTask({})}>
                <Plus className="size-3.5" /> Tarefa
              </Button>
            </div>
          </div>
          {tasks.length ? (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className={cn('flex items-center gap-3 rounded-xl border p-3', t.done ? 'border-success/25 bg-success/5' : 'border-line')}>
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', t.done ? 'border-success bg-success text-white' : 'border-line-strong')}>
                    {t.done && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-semibold', t.done ? 'text-muted line-through' : 'text-ink')}>{t.title}</p>
                    {t.description && <p className="truncate text-xs text-muted">{t.description}</p>}
                  </div>
                  <Badge>{TASK_KINDS[t.kind]}</Badge>
                  <Button variant="ghost" size="sm" className="px-1.5" onClick={() => setTask({ t })} aria-label="Editar">
                    <Pencil className="size-3.5" />
                  </Button>
                  <ActionButton action={() => deleteTask(t.id, mentoria.id)} variant="ghost" size="sm" className="px-1.5 hover:text-danger" title="Excluir">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-surface-2/60 p-4 text-sm text-muted">Sem tarefas nesta semana.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="mb-4 text-sm font-bold text-ink">Check-ins</p>
          {checkins.length ? (
            <div className="space-y-4">
              {checkins.map((c) => (
                <div key={c.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-ink">Semana de {formatDate(c.week_start)}</p>
                    <div className="flex items-center gap-3 text-xs text-ink-2">
                      <span>{Number(c.hours_studied)} h</span>
                      <span>{c.questions_done} questões</span>
                      <span className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={cn('size-3.5', n <= c.focus_rating ? 'fill-warning text-warning' : 'text-line-strong')} />
                        ))}
                      </span>
                    </div>
                  </div>
                  {c.wins && (
                    <p className="mt-2 text-sm text-ink-2">
                      <strong className="text-success">Deu certo:</strong> {c.wins}
                    </p>
                  )}
                  {c.difficulties && (
                    <p className="mt-1 text-sm text-ink-2">
                      <strong className="text-warning">Dificuldades:</strong> {c.difficulties}
                    </p>
                  )}
                  <ActionForm action={saveFeedback} success="Feedback enviado" className="mt-3 space-y-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="mentoria_id" value={mentoria.id} />
                    <Textarea name="mentor_feedback" defaultValue={c.mentor_feedback} rows={2} placeholder="Escreva seu feedback para o aluno…" maxLength={3000} />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">{c.feedback_at ? `Respondido em ${formatDateTime(c.feedback_at)}` : 'Sem feedback ainda'}</span>
                      <SubmitButton size="sm" pendingText="Enviando…">
                        {c.mentor_feedback ? 'Atualizar' : 'Enviar feedback'}
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">O aluno ainda não enviou check-ins.</p>
          )}
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card className="p-5">
          <p className="text-sm font-bold text-ink">Dados da mentoria</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">E-mail</dt>
              <dd className="truncate text-ink">{mentoria.student_email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Meta semanal</dt>
              <dd className="text-ink">{mentoria.weekly_hours_target} h</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Período</dt>
              <dd className="text-ink">
                {formatDate(mentoria.start_date)}
                {mentoria.end_date && ` – ${formatDate(mentoria.end_date)}`}
              </dd>
            </div>
          </dl>
          {mentoria.goal && <p className="mt-3 rounded-xl bg-surface-2/60 p-3 text-sm text-ink-2">{mentoria.goal}</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Editar
            </Button>
            <ActionButton
              action={async () => {
                const r = await deleteMentoria(mentoria.id);
                if (!r.error) router.push('/admin/mentoria');
                return r;
              }}
              confirm="Excluir esta mentoria com tarefas, check-ins e encontros?"
              success="Mentoria excluída"
              variant="danger"
              size="sm"
            >
              <Trash2 className="size-3.5" /> Excluir
            </ActionButton>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <CalendarClock className="size-4 text-brand" /> Encontros individuais
            </p>
            <Button size="sm" variant="secondary" onClick={() => setMeeting({})}>
              <Plus className="size-3.5" /> Agendar
            </Button>
          </div>
          {meetings.length ? (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-3">
                  <button type="button" onClick={() => setMeeting({ m })} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-ink">{m.title}</p>
                    <p className="text-xs text-muted">{formatDateTime(m.starts_at)}</p>
                  </button>
                  <ActionButton action={() => deleteMeeting(m.id)} confirm="Excluir encontro?" variant="ghost" size="sm" className="px-1.5 hover:text-danger" title="Excluir">
                    <Trash2 className="size-3.5" />
                  </ActionButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum encontro agendado.</p>
          )}
        </Card>
      </div>

      <Modal open={Boolean(task)} onClose={() => setTask(null)} title={task?.t ? 'Editar tarefa' : 'Nova tarefa'}>
        {task && (
          <ActionForm action={saveTask} success="Tarefa salva" onSuccess={() => setTask(null)} className="space-y-4">
            {task.t && <input type="hidden" name="id" value={task.t.id} />}
            <input type="hidden" name="mentoria_id" value={mentoria.id} />
            <input type="hidden" name="week_start" value={task.t?.week_start ?? week} />
            <Field label="Tarefa">
              <Input name="title" defaultValue={task.t?.title} required maxLength={200} autoFocus />
            </Field>
            <Field label="Detalhes">
              <Textarea name="description" defaultValue={task.t?.description} rows={2} maxLength={1000} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo">
                <Select name="kind" defaultValue={task.t?.kind ?? 'aula'}>
                  {Object.entries(TASK_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Prazo">
                <Input name="due_date" type="date" defaultValue={task.t?.due_date ?? ''} min={week} max={addDays(week, 6)} />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Salvar tarefa</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>

      <Modal open={Boolean(meeting)} onClose={() => setMeeting(null)} title={meeting?.m ? 'Editar encontro' : 'Novo encontro'}>
        {meeting && <MeetingForm meeting={meeting.m} mentoriaId={mentoria.id} onDone={() => setMeeting(null)} />}
      </Modal>
      <Modal open={editing} onClose={() => setEditing(false)} title="Editar mentoria" size="lg">
        <MentoriaForm mentoria={mentoria} onSaved={() => setEditing(false)} />
      </Modal>
    </div>
  );
}
