'use client';

import { ChevronRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AccessModal } from '@/components/admin/access-modal';
import { Avatar, Badge } from '@/components/ui';
import { timeAgo } from '@/lib/utils';

export interface RecentPerson {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
  created_at: string;
  status: string | null;
  class_name: string | null;
  questoes: boolean;
  mentoria: boolean;
}

/** Últimos cadastros: tocar na pessoa abre o popup para liberar turma, mentoria e questões. */
export function RecentPeople({ people, classes }: { people: RecentPerson[]; classes: { id: string; name: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <ul className="divide-y divide-line">
        {people.map((u) => {
          const mods = [u.class_name && `Turma ${u.class_name}`, u.mentoria && 'Mentoria', u.questoes && 'Questões'].filter(Boolean) as string[];
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setOpen(u.email)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 sm:px-5"
              >
                <Avatar name={u.full_name || u.email} src={u.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{u.full_name || '—'}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                  {u.role !== 'admin' && mods.length > 0 && u.status !== 'blocked' && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {mods.map((m) => (
                        <Badge key={m} className="max-w-full truncate">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {u.role === 'admin' ? (
                  <Badge tone="brand">Admin</Badge>
                ) : u.status === 'blocked' ? (
                  <Badge tone="danger">Bloqueado</Badge>
                ) : mods.length ? (
                  <Badge tone="success">Liberado</Badge>
                ) : (
                  <Badge tone="warning">Sem acesso</Badge>
                )}
                <span className="hidden text-xs text-muted sm:block">{timeAgo(u.created_at)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      <AccessModal email={open} onClose={close} classes={classes} />
    </>
  );
}
