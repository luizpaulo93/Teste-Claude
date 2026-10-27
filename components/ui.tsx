import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn, initials } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-strong shadow-[0_6px_20px_-8px_var(--brand)] active:scale-[0.98]',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2 rounded-xl',
  icon: 'size-10 rounded-xl',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer',
    'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...props} />;
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    danger: 'bg-danger/12 text-danger',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const fieldBase =
  'w-full rounded-xl border border-line-strong bg-bg-elev px-3.5 text-sm text-ink placeholder:text-muted/70 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 disabled:opacity-60';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldBase, 'h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldBase, 'min-h-24 py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(fieldBase, 'h-11 appearance-auto', className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm text-ink-2 select-none', className)}>
      <input type="checkbox" className="size-4 rounded accent-[var(--brand)]" {...props} />
      {label}
    </label>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 animate-fade-in">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold tracking-wider text-brand uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>}
      <p className="font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={cn('shrink-0 rounded-full object-cover ring-1 ring-line', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-accent font-bold text-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {icon && <span className="text-brand">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/** Imagem com lazy-load nativo; sem custo de otimização de imagem no servidor. */
export function Img({ className, alt = '', ...props }: ComponentProps<'img'>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} loading="lazy" decoding="async" className={className} {...props} />;
}
