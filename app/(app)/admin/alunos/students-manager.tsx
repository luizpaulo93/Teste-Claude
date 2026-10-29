'use client';

import { confirmDialog } from '@/components/confirm';

import { Ban, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ActionForm } from '@/components/admin/action-form';
import { toast } from '@/components/toast';
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui';
import { ActionButton, Modal, Spinner, SubmitButton } from '@/components/ui-client';
import type { ClassGroup, Student } from '@/lib/types';
import { cn } from '@/lib/utils';
import { bulkStudents, deleteStudent, importStudents, saveStudent, setStudentStatus } from '../people-actions';

export function StudentsManager({
  students,
  classes,
  profiles,
  total,
  page,
  pageSize,
  filters,
}: {
  students: Student[];
  classes: ClassGroup[];
  profiles: { email: string; full_name: string; avatar_url: string }[];
  total: number;
  page: number;
  pageSize: number;
  filters: { q: string; turma: string; status: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<{ student?: Student } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(filters.q);
  const profileBy = new Map(profiles.map((p) => [p.email.toLowerCase(), p]));
  const className = (id: string | null) => classes.find((c) => c.id === id)?.name;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const setParam = (patch: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    if (!('p' in patch)) sp.delete('p');
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    setSelected(new Set());
  };

  const toggleAll = () => setSelected((s) => (s.size === students.length ? new Set() : new Set(students.map((x) => x.id))));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = (op: Parameters<typeof bulkStudents>[1], msg: string) =>
    start(async () => {
      const r = await bulkStudents([...selected], op);
      if (r.error) toast.error(r.error);
      else {
        toast(msg);
        setSelected(new Set());
      }
    });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam({ q });
          }}
          className="relative flex-1"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone" className="pl-10" />
        </form>
        <div className="flex gap-2">
          <Select value={filters.turma} onChange={(e) => setParam({ turma: e.target.value })} className="w-auto min-w-36">
            <option value="">Todas as turmas</option>
            <option value="none">Sem turma</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={filters.status} onChange={(e) => setParam({ status: e.target.value })} className="w-auto">
            <option value="">Todos</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Importar
          </Button>
          <Button onClick={() => setEdit({})}>
            <UserPlus className="size-4" /> Adicionar
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="flex animate-slide-up flex-wrap items-center gap-2 border-brand/30 bg-brand-soft p-3">
          <span className="mr-2 text-sm font-semibold text-ink">{selected.size} selecionados</span>
          <Select onChange={(e) => e.target.value && bulk({ class_id: e.target.value === 'none' ? null : e.target.value }, 'Turma atualizada')} defaultValue="" className="h-9 w-auto text-xs">
            <option value="">Mover para turma…</option>
            <option value="none">Sem turma</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => bulk({ status: 'active' }, 'Alunos liberados')}>
            <CheckCircle2 className="size-3.5" /> Liberar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulk({ status: 'blocked' }, 'Alunos bloqueados')}>
            <Ban className="size-3.5" /> Bloquear
          </Button>
          <Button size="sm" variant="danger" onClick={async () => (await confirmDialog(`Remover ${selected.size} alunos da lista?`)) && bulk({ remove: true }, 'Alunos removidos')}>
            <Trash2 className="size-3.5" /> Remover
          </Button>
          {pending && <Spinner className="text-brand" />}
        </Card>
      )}

      <Card className={cn('overflow-hidden transition-opacity', pending && 'opacity-60')}>
        {students.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left text-xs font-semibold text-muted">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={selected.size === students.length} onChange={toggleAll} className="size-4 accent-[var(--brand)]" aria-label="Selecionar todos" />
                  </th>
                  <th className="px-2 py-3">Aluno</th>
                  <th className="px-2 py-3">Turma</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Conta</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((s) => {
                  const prof = profileBy.get(s.email.toLowerCase());
                  return (
                    <tr key={s.id} className={cn('transition-colors hover:bg-surface-2/50', selected.has(s.id) && 'bg-brand-soft/50')}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[var(--brand)]" aria-label={`Selecionar ${s.email}`} />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name || prof?.full_name || s.email} src={prof?.avatar_url} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{s.name || prof?.full_name || '—'}</p>
                            <p className="truncate text-xs text-muted">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3">{className(s.class_id) ? <Badge>{className(s.class_id)}</Badge> : <Badge tone="warning">Sem turma</Badge>}</td>
                      <td className="px-2 py-3">
                        <Badge tone={s.status === 'active' ? 'success' : 'danger'}>{s.status === 'active' ? 'Ativo' : 'Bloqueado'}</Badge>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">{prof ? 'Já entrou' : 'Nunca entrou'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <ActionButton
                            action={() => setStudentStatus(s.id, s.status === 'active' ? 'blocked' : 'active')}
                            success={s.status === 'active' ? 'Aluno bloqueado' : 'Aluno liberado'}
                            variant="ghost"
                            size="sm"
                            className="px-2"
                            title={s.status === 'active' ? 'Bloquear' : 'Liberar'}
                          >
                            {s.status === 'active' ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                          </ActionButton>
                          <Button variant="ghost" size="sm" className="px-2" onClick={() => setEdit({ student: s })} aria-label="Editar">
                            <Pencil className="size-4" />
                          </Button>
                          <ActionButton action={() => deleteStudent(s.id)} confirm={`Remover ${s.email} da lista?`} success="Aluno removido" variant="ghost" size="sm" className="px-2 hover:text-danger" title="Remover">
                            <Trash2 className="size-4" />
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState title="Nenhum aluno encontrado" description="Adicione alunos um a um ou importe uma lista de e-mails." />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
          <span>
            {total} aluno{total === 1 ? '' : 's'}
          </span>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setParam({ p: String(page - 1) })} aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setParam({ p: String(page + 1) })} aria-label="Próxima">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.student ? 'Editar aluno' : 'Adicionar aluno'}>
        {edit && (
          <ActionForm action={saveStudent} success="Aluno salvo" onSuccess={() => setEdit(null)} className="space-y-4">
            {edit.student && <input type="hidden" name="id" value={edit.student.id} />}
            <Field label="E-mail (o mesmo usado no login)">
              <Input name="email" type="email" required defaultValue={edit.student?.email} autoFocus={!edit.student} />
            </Field>
            <Field label="Nome">
              <Input name="name" defaultValue={edit.student?.name} maxLength={160} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telefone">
                <Input name="phone" defaultValue={edit.student?.phone} inputMode="tel" />
              </Field>
              <Field label="CPF">
                <Input name="cpf" defaultValue={edit.student?.cpf} inputMode="numeric" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Turma">
                <Select name="class_id" defaultValue={edit.student?.class_id ?? classes[0]?.id ?? ''}>
                  <option value="">Sem turma</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue={edit.student?.status ?? 'active'}>
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado</option>
                </Select>
              </Field>
            </div>
            <Field label="Nascimento">
              <Input name="birth_date" type="date" defaultValue={edit.student?.birth_date ?? ''} />
            </Field>
            <div className="flex justify-end">
              <SubmitButton>Salvar</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar alunos" size="lg">
        <ActionForm
          action={async (fd) => {
            const r = await importStudents(fd);
            if (r.ok) toast(`${r.count} alunos processados`);
            return r.ok ? { ok: true } : r;
          }}
          success="Importação concluída"
          onSuccess={() => setImportOpen(false)}
          className="space-y-4"
        >
          <p className="text-sm text-muted">
            Cole uma linha por aluno. Aceita <code className="text-ink">nome; email; telefone</code>, copiar e colar do Excel/Planilhas, ou apenas e-mails.
          </p>
          <Textarea name="lines" rows={10} required placeholder={'Maria Souza; maria@gmail.com; 91999990000\njoao@gmail.com'} className="font-mono text-xs" />
          <Field label="Colocar todos na turma">
            <Select name="class_id" defaultValue={classes[0]?.id ?? ''}>
              <option value="">Sem turma</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end">
            <SubmitButton pendingText="Importando…">Importar</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </div>
  );
}
