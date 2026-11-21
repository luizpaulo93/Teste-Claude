/**
 * Textura da marca: fórmulas de Física, Química e Matemática espalhadas bem apagadas sobre o quadriculado,
 * como um caderno de exatas. Só decoração (escondida dos leitores de tela).
 */
const ITEMS: [string, number, number, number][] = [
  // [fórmula, x %, y %, tamanho em rem]
  ['F = m · a', 8, 12, 1.5],
  ['v² = v₀² + 2aΔs', 52, 8, 1.1],
  ['E = m · c²', 70, 26, 1.35],
  ['pV = nRT', 14, 34, 1.25],
  ['Δ = b² − 4ac', 46, 42, 1.4],
  ['sen²x + cos²x = 1', 6, 56, 1],
  ['U = R · i', 62, 58, 1.2],
  ['pH = −log[H⁺]', 30, 68, 1.05],
  ['∫ x dx = x²/2 + C', 58, 76, 1.1],
  ['λ = h / p', 12, 84, 1.2],
  ['n = c / v', 78, 90, 1],
];

export function Formulas({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}>
      {ITEMS.map(([f, x, y, s]) => (
        <span key={f} className="absolute font-mono whitespace-nowrap text-white/[0.09]" style={{ left: `${x}%`, top: `${y}%`, fontSize: `${s}rem` }}>
          {f}
        </span>
      ))}
    </div>
  );
}
