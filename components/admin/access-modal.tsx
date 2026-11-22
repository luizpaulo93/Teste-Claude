'use client';

import { FileQuestion, Target, UsersRound } from 'lucide-react';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { getAccess, saveAccess, type Access, type AccessInput } from '@/app/(app)/admin/access-actions';
import { toast } from '@/components/toast';
import { Avatar, Button, Select } from '@/components/ui';
import { Modal, Spinner } from '@/components/ui-client';
import { cn } from '@/lib/utils';

type ClassOpt = { id: string; name: string };

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-surface-3')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} />
    </button>
  );
}

function ModuleRow({
  icon,
  title,
  description,
  on,
  onChange,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  on: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border p-3.5 transition-colors', on ? 'border-brand/40 bg-brand-soft/40' : 'border-line bg-surface-2/50')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-brand text-white' : 'bg-surface-3 text-muted')}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <Toggle on={on} onChange={onChange} label={title} />
      </div>
      {on && children && <div className="mt-3 pl-11">{children}</div>}
    </div>
  );
}

/** Os módulos que dá para liberar: turma, mentoria e questões (cada um liga e desliga). */
export function AccessFields({
  value,
  onChange,
  classes,
  mentoriaGroup,
}: {
  value: AccessInput;
  onChange: (v: AccessInput) => void;
  classes: ClassOpt[];
  mentoriaGroup?: string | null;
}) {
  const set = (patch: Partial<AccessInput>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-2.5">
      <ModuleRow
        icon={<UsersRound className="size-4" />}
        title="Turma"
        description="Cursos e aulas da turma, ao vivo, simulados e desempenho."
        on={value.classId !== null}
        onChange={(v) => set({ classId: v ? (classes[0]?.id ?? '') : null })}
      >
        {classes.length ? (
          <Select value={value.classId ?? ''} onChange={(e) => set({ classId: e.target.value })} aria-label="Turma" className="h-9 text-sm">
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-xs text-danger">Crie uma turma primeiro (Admin → Turmas).</p>
        )}
      </ModuleRow>
      <ModuleRow
        icon={<Target className="size-4" />}
        title="Mentoria"
        description="Trilha por níveis, revisões, agenda e painel do aluno."
        on={value.mentoria}
        onChange={(v) => set({ mentoria: v })}
      />
      {mentoriaGroup && !value.mentoria && (
        <p className="px-1 text-[11px] text-muted">Continua com a mentoria do grupo “{mentoriaGroup}” (tire pelo grupo, em Mentoria).</p>
      )}
      <ModuleRow
        icon={<FileQuestion className="size-4" />}
        title="Questões e geração de listas"
        description="Banco de exercícios e listas que o próprio aluno monta."
        on={value.questoes}
        onChange={(v) => set({ questoes: v })}
      />
    </div>
  );
}

/** Popup de acesso de uma pessoa: abre ao clicar no nome. */
export function AccessModal({ email, onClose, classes }: { email: string | null; onClose: () => void; classes: ClassOpt[] }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [value, setValue] = useState<AccessInput>({ classId: null, mentoria: false, questoes: false });
  const [saving, start] = useTransition();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    setAccess(null);
    if (!email) return;
    let alive = true;
    void getAccess(email).then((r) => {
      if (!alive) return;
      if (r.error || !r.access) {
        toast.error(r.error ?? 'Não foi possível abrir.');
        close.current();
        return;
      }
      setAccess(r.access);
      setValue({ classId: r.access.classId && classes.some((c) => c.id === r.access!.classId) ? r.access.classId : null, mentoria: r.access.mentoria, questoes: r.access.questoes });
    });
    return () => {
      alive = false;
    };
  }, [email, classes]);

  const save = () =>
    start(async () => {
      if (!email) return;
      const r = await saveAccess([email], value);
      if (r.error) return void toast.error(r.error);
      toast('Acesso atualizado');
      onClose();
    });

  return (
    <Modal
      open={Boolean(email)}
      onClose={onClose}
      title="Liberar acesso"
      footer={
        access && !access.isAdmin ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || value.classId === ''}>
              {saving && <Spinner />} Salvar acesso
            </Button>
          </>
        ) : undefined
      }
    >
      {!access ? (
        <div className="grid place-items-center py-10">
          <Spinner className="text-brand" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={access.name || access.email} src={access.avatar} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{access.name || access.email}</p>
              <p className="truncate text-xs text-muted">{access.email}</p>
            </div>
          </div>
          {access.isAdmin ? (
            <p className="rounded-xl border border-line p-4 text-sm text-muted">Administrador: já tem acesso a tudo na plataforma.</p>
          ) : (
            <>
              {access.blocked && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">Está bloqueado. Salvar libera os módulos marcados.</p>
              )}
              <AccessFields value={value} onChange={setValue} classes={classes} mentoriaGroup={access.mentoriaGroup} />
              <p className="text-[11px] text-muted">Listas enviadas pela mentoria ou pela turma abrem sempre, mesmo sem o módulo de questões.</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
