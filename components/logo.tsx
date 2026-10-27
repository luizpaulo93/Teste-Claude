export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={`shrink-0 select-none ${className}`}>
      <polygon points="6,10 29,10 59,72 49,92" fill="currentColor" />
      <polygon points="33,11 59,11 46,36" stroke="currentColor" strokeWidth="3.2" fill="none" />
      <polygon points="49,37 62,12 75,37" stroke="currentColor" strokeWidth="3.2" fill="none" />
      <polygon points="65,11 92,11 78.5,36" stroke="currentColor" strokeWidth="3.2" fill="none" />
      <polygon points="49,41 76,41 62.5,67" fill="currentColor" />
    </svg>
  );
}
