import { PlotBackdrop } from "./PlotBackdrop";
import { SimilarityTooltip } from "./SimilarityTooltip";
import {
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type PlotPoint,
} from "./model";

interface SimilarityPlotProps {
  activePointId: string | null;
  appliedThreshold: number;
  onActivePointChange: (pointId: string | null) => void;
  points: PlotPoint[];
  previewThreshold: number;
  totalTraces: number;
}

function pointLabel(point: PlotPoint): string {
  return [
    `Prompt: ${point.prompt}.`,
    `Similarity ${point.similarity.toFixed(3)}.`,
    `Projected ${point.isProjectedHit ? "hit" : "miss"}.`,
    `Actual ${point.actualCacheHit ? "hit" : "miss"}.`,
  ].join(" ");
}

export function SimilarityPlot({
  activePointId,
  appliedThreshold,
  onActivePointChange,
  points,
  previewThreshold,
  totalTraces,
}: SimilarityPlotProps): JSX.Element {
  const activePoint =
    points.find((point) => point.id === activePointId) ?? null;

  return (
    <div className="mt-3 overflow-x-auto">
      <svg
        aria-label={`${points.length} of ${totalTraces} recent traces plotted on a zero-to-one similarity scale`}
        className="block min-w-[520px] w-full"
        role="group"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      >
        <PlotBackdrop
          appliedThreshold={appliedThreshold}
          previewThreshold={previewThreshold}
        />

        {points.map((point, index) => {
          const isActive = point.id === activePointId;
          const color = point.isProjectedHit
            ? "var(--gold)"
            : "var(--coral)";
          const baseRadius = index === 0 ? "7" : "5";
          const radius = isActive ? "8" : baseRadius;

          return (
            <g
              key={point.id}
              aria-label={pointLabel(point)}
              data-active={isActive ? "true" : "false"}
              role="button"
              tabIndex={0}
              onBlur={() => onActivePointChange(null)}
              onClick={() => onActivePointChange(point.id)}
              onFocus={() => onActivePointChange(point.id)}
              onMouseEnter={() => onActivePointChange(point.id)}
              onMouseLeave={() => onActivePointChange(null)}
            >
              {isActive && (
                <circle
                  aria-hidden="true"
                  cx={point.x}
                  cy={point.y}
                  fill="none"
                  pointerEvents="none"
                  r="12"
                  stroke={color}
                  strokeOpacity="0.45"
                  strokeWidth="3"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                data-testid="similarity-point"
                data-trace-id={point.id}
                fill={color}
                r={radius}
                stroke={isActive ? "var(--text)" : "var(--ink)"}
                strokeWidth={isActive ? "3" : "2"}
              />
            </g>
          );
        })}

        {activePoint !== null && (
          <SimilarityTooltip point={activePoint} />
        )}
      </svg>
    </div>
  );
}
