/**
 * Inline-SVG-Sparkline. Server-render-fähig (Server Component).
 */

interface SparklineProps {
  data: { day: string; count: number }[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 22,
  className,
}: SparklineProps) {
  if (data.length === 0) return null;

  const max = Math.max(1, ...data.map((d) => d.count));
  const padX = 1;
  const padY = 2;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  // X-Schritt
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  // Linien-Punkte
  const points = data
    .map((d, i) => {
      const x = padX + i * stepX;
      const y = padY + innerH - (d.count / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Letzter Punkt für Highlight-Dot
  const last = data[data.length - 1];
  const lastX = padX + (data.length - 1) * stepX;
  const lastY = padY + innerH - (last.count / max) * innerH;

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Klicks der letzten ${data.length} Tage: insgesamt ${total}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="#1d284d"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="1.8" fill="#9b0a00" />
    </svg>
  );
}
