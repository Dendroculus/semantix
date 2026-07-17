import {
  PLOT_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  type PlotPoint,
} from "./model";

const TOOLTIP_WIDTH = 270;
const TOOLTIP_HEIGHT = 104;
const TOOLTIP_GAP = 12;

interface SimilarityTooltipProps {
  point: PlotPoint;
}

function tooltipPosition(point: PlotPoint): {
  x: number;
  y: number;
} {
  const desiredX = point.x - TOOLTIP_WIDTH / 2;
  const x = Math.max(
    4,
    Math.min(VIEW_WIDTH - TOOLTIP_WIDTH - 4, desiredX),
  );
  const desiredY =
    point.y > PLOT_TOP + TOOLTIP_HEIGHT
      ? point.y - TOOLTIP_HEIGHT - TOOLTIP_GAP
      : point.y + TOOLTIP_GAP;
  const y = Math.max(
    4,
    Math.min(VIEW_HEIGHT - TOOLTIP_HEIGHT - 4, desiredY),
  );

  return { x, y };
}

export function SimilarityTooltip({
  point,
}: SimilarityTooltipProps): JSX.Element {
  const position = tooltipPosition(point);
  const previewColor = point.isProjectedHit
    ? "var(--gold)"
    : "var(--coral)";

  return (
    <foreignObject
      height={TOOLTIP_HEIGHT}
      pointerEvents="none"
      width={TOOLTIP_WIDTH}
      x={position.x}
      y={position.y}
    >
      <div
        className="h-full border border-[var(--teal)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] shadow-lg"
        role="tooltip"
      >
        <p className="ui-label text-[var(--teal)]">
          Selected trace
        </p>
        <p className="mt-1 max-h-[34px] overflow-hidden break-words text-[11px] leading-[17px]">
          {point.prompt}
        </p>
        <div className="font-data mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px]">
          <span>Score {point.similarity.toFixed(3)}</span>
          <span style={{ color: previewColor }}>
            Preview {point.isProjectedHit ? "HIT" : "MISS"}
          </span>
          <span
            className={
              point.actualCacheHit
                ? "text-[var(--gold)]"
                : "text-[var(--coral)]"
            }
          >
            Actual {point.actualCacheHit ? "HIT" : "MISS"}
          </span>
        </div>
      </div>
    </foreignObject>
  );
}
