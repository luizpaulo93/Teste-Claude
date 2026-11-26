/**
 * Logo do Curso Vértice: a haste do V e o triângulo dividido em quatro (três vazados em cima, um cheio embaixo).
 * Desenho geométrico (triângulos equiláteros, mesmos espaçamentos), o mesmo dos ícones do app e do APK.
 */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="6.00 3.64 90.00 90.00" fill="none" aria-hidden="true" className={`shrink-0 select-none ${className}`}>
      <path d="M8 14 L32 14 L60 62.5 L48 83.28 Z" fill="currentColor" fillRule="evenodd" />
      <path d="M39.91 15.1 L64.09 15.1 L52 36.05 Z M52 31.05 L59.76 17.6 L44.24 17.6 Z" fill="currentColor" fillRule="evenodd" />
      <path d="M67.91 15.1 L92.09 15.1 L80 36.05 Z M80 31.05 L87.76 17.6 L72.24 17.6 Z" fill="currentColor" fillRule="evenodd" />
      <path d="M53.91 37.15 L78.09 37.15 L66 16.2 Z M66 21.2 L73.76 34.65 L58.24 34.65 Z" fill="currentColor" fillRule="evenodd" />
      <path d="M53.91 39.35 L78.09 39.35 L66 60.3 Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
