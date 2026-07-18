interface ChartPoint {
  x: number;
  y: number;
}

interface ChartSeries {
  color: string;
  label: string;
  points: ChartPoint[];
}

interface LineChartProps {
  series: ChartSeries[];
  title: string;
  valueLabel: (value: number) => string;
}

const WIDTH = 320;
const HEIGHT = 156;
const LEFT = 38;
const RIGHT = 12;
const TOP = 16;
const BOTTOM = 28;

export function LineChart({
  series,
  title,
  valueLabel,
}: Readonly<LineChartProps>): JSX.Element {
  const points = series.flatMap((item) => item.points);
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(0, ...yValues);
  const rawMaxY = Math.max(...yValues);
  const maxY = rawMaxY === minY ? minY + 1 : rawMaxY;
  const x = (value: number): number =>
    LEFT + ((value - minX) / Math.max(maxX - minX, 0.001)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number): number =>
    TOP + ((maxY - value) / (maxY - minY)) * (HEIGHT - TOP - BOTTOM);

  return (
    <figure className="border-t border-(--hairline) pt-4">
      <figcaption className="ui-label text-(--text-muted)">{title}</figcaption>
      <svg
        aria-labelledby={`${title.replaceAll(" ", "-")}-chart-title`}
        className="mt-3 h-auto w-full"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title id={`${title.replaceAll(" ", "-")}-chart-title`}>
          {title}. Thresholds {minX.toFixed(2)} through {maxX.toFixed(2)}.
        </title>
        {[0, 0.5, 1].map((fraction) => {
          const value = minY + (maxY - minY) * fraction;
          const position = y(value);
          return (
            <g key={fraction}>
              <line
                stroke="var(--hairline)"
                x1={LEFT}
                x2={WIDTH - RIGHT}
                y1={position}
                y2={position}
              />
              <text
                fill="var(--text-faint)"
                fontSize="8"
                textAnchor="end"
                x={LEFT - 5}
                y={position + 3}
              >
                {valueLabel(value)}
              </text>
            </g>
          );
        })}
        {series.map((item) => (
          <g key={item.label}>
            <polyline
              fill="none"
              points={item.points
                .map((point) => `${x(point.x)},${y(point.y)}`)
                .join(" ")}
              stroke={item.color}
              strokeWidth="2"
            />
            {item.points.map((point) => (
              <circle
                key={`${point.x}-${point.y}`}
                cx={x(point.x)}
                cy={y(point.y)}
                fill={item.color}
                r="2.5"
              />
            ))}
          </g>
        ))}
        <text fill="var(--text-faint)" fontSize="8" x={LEFT} y={HEIGHT - 7}>
          {minX.toFixed(2)}
        </text>
        <text
          fill="var(--text-faint)"
          fontSize="8"
          textAnchor="end"
          x={WIDTH - RIGHT}
          y={HEIGHT - 7}
        >
          {maxX.toFixed(2)} threshold
        </text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-4">
        {series.map((item) => (
          <span
            className="font-data flex items-center gap-2 text-[9px] text-(--text-muted)"
            key={item.label}
          >
            <span
              aria-hidden="true"
              className="size-1.5  rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
