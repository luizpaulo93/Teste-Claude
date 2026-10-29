'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';
import { buttonClass } from './ui';
import { toast } from './toast';
import { confirmDialog } from './confirm';
import { createPortal } from 'react-dom';

export function SubmitButton({
  children,
  pendingText = 'Salvando…',
  variant = 'primary',
  size = 'md',
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size, className)}>
      {pending ? (
        <>
          <Spinner /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', full: 'sm:max-w-6xl' };
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-surface shadow-2xl sm:rounded-3xl',
          widths[size],
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0 truncate text-base font-bold text-ink">{title}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" className={buttonClass('ghost', 'icon', 'size-9')}>
            <X className="size-5" />
          </button>
        </div>
        <div className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5', footer ? 'pb-5' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]')}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3 safe-bottom">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Botão que roda uma server action com confirmação opcional e feedback. */
export function ActionButton({
  action,
  confirm,
  children,
  success,
  variant = 'secondary',
  size = 'sm',
  className,
  title,
  disabled,
}: {
  action: () => Promise<{ error?: string } | void>;
  disabled?: boolean;
  confirm?: string;
  children: ReactNode;
  success?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  className?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={pending || disabled}
      className={buttonClass(variant, size, className)}
      onClick={async () => {
        if (confirm && !(await confirmDialog(confirm))) return;
        start(async () => {
          const res = await action();
          if (res && res.error) toast.error(res.error);
          else if (success) toast(success);
        });
      }}
    >
      {pending ? <Spinner /> : children}
    </button>
  );
}

export function Switch({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  const [on, setOn] = useState(Boolean(defaultChecked));
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-surface-2/60 p-3.5">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <input type="hidden" name={name} value={on ? 'on' : ''} />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-surface-3')}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} />
      </button>
    </label>
  );
}
