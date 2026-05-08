/**
 * 7×24-Heatmap (Wochentag × Stunde) als Inline-SVG.
 * Server-render-fähig.
 */

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function Heatmap({
  data,
  className,
}: {
  /** 7 × 24 Matrix, [dow][hour] = count. dow: 0=So..6=Sa */
  data: number[][];
  className?: string;
}) {
  // Maximum für Skalierung
  let max = 0;
  for (const row of data) for (const v of row) if (v > max) max = v;

  const cell = 14;
  const gap = 2;
  const labelW = 28;
  const labelH = 12;
  const w = labelW + 24 * (cell + gap);
  const h = labelH + 7 * (cell + gap);

  function colorFor(value: number): string {
    if (max === 0 || value === 0) return '#f5f5f5';
    const intensity = Math.min(1, value / max);
    // Brand-Tintenblau mit variabler Sättigung – über Alpha auf Weiß.
    const alpha = 0.2 + intensity * 0.8;
    return `rgba(29, 40, 77, ${alpha.toFixed(2)})`;
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="auto"
      className={className}
      role="img"
      aria-label="Klicks pro Wochentag und Stunde"
    >
      {/* Stunden-Labels (jede 6. Stunde) */}
      {[0, 6, 12, 18].map((hr) => (
        <text
          key={hr}
          x={labelW + hr * (cell + gap) + cell / 2}
          y={labelH - 2}
          fontSize="9"
          fill="#737373"
          textAnchor="middle"
        >
          {hr.toString().padStart(2, '0')}
        </text>
      ))}

      {/* Wochentag-Labels + Zellen */}
      {data.map((row, dow) => (
        <g key={dow} transform={`translate(0, ${labelH + dow * (cell + gap)})`}>
          <text x={labelW - 6} y={cell - 2} fontSize="9" fill="#737373" textAnchor="end">
            {DOW_LABELS[dow]}
          </text>
          {row.map((count, hour) => (
            <rect
              key={hour}
              x={labelW + hour * (cell + gap)}
              y={0}
              width={cell}
              height={cell}
              rx={2}
              fill={colorFor(count)}
            >
              <title>
                {DOW_LABELS[dow]} {hour.toString().padStart(2, '0')}:00 –{' '}
                {count} Klick{count === 1 ? '' : 's'}
              </title>
            </rect>
          ))}
        </g>
      ))}
    </svg>
  );
}
