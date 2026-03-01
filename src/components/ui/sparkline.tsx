'use client';

interface SparklinePoint {
  period: string;
  value: number;
}

interface SparklineProps {
  data: SparklinePoint[];
  higherIsBetter?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, higherIsBetter = true, width = 80, height = 28, className = '' }: SparklineProps) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Build SVG polyline points
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = range === 0
      ? height / 2
      : height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const first = values[0];
  const last = values[values.length - 1];
  const isRising = last > first;
  const isFlat = Math.abs(last - first) < 0.01;

  // Determine color: green = good direction, red = bad direction
  let color: string;
  if (isFlat) {
    color = '#94a3b8';
  } else if (higherIsBetter) {
    color = isRising ? '#10b981' : '#ef4444';
  } else {
    color = isRising ? '#ef4444' : '#10b981';
  }

  // Arrow indicator
  const arrowUp = '▲';
  const arrowDown = '▼';
  const arrow = isFlat ? '→' : isRising ? arrowUp : arrowDown;
  const pctChange = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label={`Trend: ${isFlat ? 'flat' : isRising ? 'rising' : 'falling'}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible flex-shrink-0">
        {/* Area fill */}
        <defs>
          <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Filled area */}
        <polygon
          points={`2,${height} ${points} ${(width - 2).toFixed(1)},${height}`}
          fill={`url(#spark-grad-${color.replace('#', '')})`}
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={((values.length - 1) / (values.length - 1)) * (width - 4) + 2}
          cy={range === 0 ? height / 2 : height - 2 - ((last - min) / range) * (height - 4)}
          r="2.5"
          fill={color}
        />
      </svg>
      <span className="text-[10px] font-semibold tabular-nums flex-shrink-0" style={{ color }}>
        {arrow}{' '}
        {Math.abs(pctChange) < 0.1 ? '—' : `${Math.abs(pctChange).toFixed(1)}%`}
      </span>
    </div>
  );
}
