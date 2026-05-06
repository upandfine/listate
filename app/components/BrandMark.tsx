/**
 * Brand-Signet von Listate – drei Listen-Balken + hohler Pfeil.
 * Drei Varianten:
 *   - "inverse"  → weiße Bars + Pfeil auf farbigem Hintergrund (für rotes Quadrat)
 *   - "color"    → Bars in Tintenblau, Pfeil in Burgundy (für hellen Hintergrund)
 *   - "mono"     → Bars + Pfeil in Tintenblau (für gedeckten Look)
 */
type Variant = 'inverse' | 'color' | 'mono';

export function BrandMark({
  variant = 'color',
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const barFill =
    variant === 'inverse'
      ? '#ffffff'
      : '#1d284d';
  const arrowFill =
    variant === 'inverse'
      ? '#ffffff'
      : variant === 'mono'
        ? '#1d284d'
        : '#9b0a00';

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="14" y="26" width="46" height="10" rx="3" fill={barFill} />
      <rect x="14" y="45" width="46" height="10" rx="3" fill={barFill} />
      <rect x="14" y="64" width="30" height="10" rx="3" fill={barFill} />
      <path
        d="M 64 32 L 74 32 L 90 50 L 74 68 L 64 68 L 80 50 Z"
        fill={arrowFill}
      />
    </svg>
  );
}

/**
 * Quadratischer Brand-Container (rotes Hintergrundquadrat) mit weißem Signet
 * – matching dem Favicon. Größe per `className` (z. B. `h-7 w-7`).
 */
export function BrandTile({ className }: { className?: string }) {
  return (
    <span
      className={
        'inline-flex items-center justify-center rounded-md bg-accent ' +
        (className ?? 'h-7 w-7')
      }
    >
      <BrandMark variant="inverse" className="h-[72%] w-[72%]" />
    </span>
  );
}
