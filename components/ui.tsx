import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn, initials } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3 border border-line',
  outline: 'border border-line-strong text-ink hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15 border border-danger/25',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-sm gap-2 rounded-lg',
  icon: 'size-10 rounded-lg',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    // ao tocar, afunda 1px (resposta física, sem brilho)
    'inline-flex items-center justify-center font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform] duration-150 select-none cursor-pointer active:translate-y-px',
    'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-line bg-surface shadow-card', className)} {...props} />;
}

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-3 text-ink-2',
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    danger: 'bg-danger/12 text-danger',
  };
  return (
    <span
      // padrão dos cartões do painel: rótulo monoespaçado em maiúsculas (com a cor do estado)
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.04em] whitespace-nowrap uppercase',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const fieldBase =
  'w-full rounded-lg border border-line-strong bg-bg-elev px-3.5 text-sm text-ink placeholder:text-muted/70 transition focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/15 disabled:opacity-60';

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
      <span className="block font-mono text-[11px] tracking-[0.06em] text-muted uppercase">{label}</span>
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

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 sm:mb-8">
      {/* o título fica com pelo menos 22rem: se os botões não couberem ao lado (iPad em pé), descem para a linha de baixo */}
      <div className="min-w-0 flex-1 basis-[min(100%,22rem)] animate-fade-in">
        {/* rótulo discreto (cinza, monoespaçado) em vez de letreiro azul acima de todo título */}
        {eyebrow && <div className="mb-2 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-[1.9rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Título de seção padrão em todo o app (com link opcional à direita, ex.: "Ver tudo"). */
export function SectionHeader({ title, href, link, icon }: { title: ReactNode; href?: string; link?: string; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-[-0.015em] text-ink sm:text-lg">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {href && (
        <Link href={href} className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-ink">
          {link ?? 'Ver tudo'}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-lg border border-line bg-surface-2 text-muted">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
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
      className={cn('grid shrink-0 place-items-center rounded-full border border-line-strong bg-surface-3 font-semibold text-ink-2', className)}
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
      <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className="num mt-2.5 text-[1.7rem] font-medium text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

/** Imagem com lazy-load nativo; sem custo de otimização de imagem no servidor. */
export function Img({ className, alt = '', ...props }: ComponentProps<'img'>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} loading="lazy" decoding="async" className={className} {...props} />;
}
