'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { toast } from '@/components/toast';

type Result = { ok?: true; error?: string; id?: string } | null;

/** Formulário que chama uma server action, mostra toast e avisa o pai em caso de sucesso. */
export function ActionForm({
  action,
  children,
  success = 'Salvo com sucesso',
  onSuccess,
  className,
  resetOnSuccess,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: ReactNode;
  success?: string;
  onSuccess?: (r: NonNullable<Result>) => void;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(async (_: Result, fd: FormData) => action(fd), null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      toast(success);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.(state);
    }
  }, [state, success, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
    </form>
  );
}
