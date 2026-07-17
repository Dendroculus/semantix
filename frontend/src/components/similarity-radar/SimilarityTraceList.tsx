import { formatPrompt, type PlotPoint } from "./model";

interface SimilarityTraceListProps {
  activePointId: string | null;
  onActivePointChange: (pointId: string | null) => void;
  points: PlotPoint[];
}

export function SimilarityTraceList({
  activePointId,
  onActivePointChange,
  points,
}: SimilarityTraceListProps): JSX.Element | null {
  if (points.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="ui-label grid grid-cols-[minmax(0,1fr)_58px_52px] gap-3 border-b border-[var(--hairline)] pb-2 text-[var(--text-faint)]">
        <span>Recent scored query</span>
        <span className="text-right">Score</span>
        <span className="text-right">Preview</span>
      </div>

      {points.map((point) => {
        const isActive = point.id === activePointId;

        return (
          <button
            key={point.id}
            aria-label={`Inspect ${point.prompt}`}
            className="font-data grid w-full grid-cols-[minmax(0,1fr)_58px_52px] gap-3 border-b border-[rgba(234,230,221,0.05)] py-2.5 text-left text-[10px] outline-none transition-colors focus-visible:bg-[rgba(91,156,148,0.08)]"
            data-active={isActive ? "true" : "false"}
            type="button"
            onBlur={() => onActivePointChange(null)}
            onClick={() => onActivePointChange(point.id)}
            onFocus={() => onActivePointChange(point.id)}
            onMouseEnter={() => onActivePointChange(point.id)}
            onMouseLeave={() => onActivePointChange(null)}
          >
            <span
              className={
                isActive
                  ? "truncate text-[var(--text)]"
                  : "truncate text-[var(--text-muted)]"
              }
              title={point.prompt}
            >
              {formatPrompt(point.prompt)}
            </span>
            <span className="text-right text-[var(--teal)]">
              {point.similarity.toFixed(3)}
            </span>
            <span
              className="text-right"
              style={{
                color: point.isProjectedHit
                  ? "var(--gold)"
                  : "var(--coral)",
              }}
            >
              {point.isProjectedHit ? "HIT" : "MISS"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
