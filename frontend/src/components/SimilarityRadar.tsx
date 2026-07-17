import { useMemo } from "react";

import type { QueryTrace } from "../types/dashboard";

interface SimilarityRadarProps {
  appliedThreshold: number;
  isApplyingThreshold: boolean;
  traces: QueryTrace[];
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  onThresholdApply: (threshold: number) => void;
}

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 230;
const PLOT_LEFT = 34;
const PLOT_RIGHT = 606;
const PLOT_TOP = 58;
const PLOT_BOTTOM = 178;
const AXIS_Y = 190;
const FIXED_TICKS = [0, 0.25, 0.5, 0.75, 0.9, 1];

type ScoredTrace = QueryTrace & { similarity: number };

interface PlotPoint extends ScoredTrace {
  isProjectedHit: boolean;
  x: number;
  y: number;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function isScoredTrace(
  trace: QueryTrace,
): trace is ScoredTrace {
  return trace.similarity !== null;
}

function scoreToX(score: number): number {
  const normalizedScore = clampScore(score);

  return (
    PLOT_LEFT +
    normalizedScore * (PLOT_RIGHT - PLOT_LEFT)
  );
}

function stableJitter(id: string): number {
  let hash = 0;

  for (const character of id) {
    hash =
      (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return (
    PLOT_TOP +
    (hash % (PLOT_BOTTOM - PLOT_TOP))
  );
}

function formatPrompt(prompt: string): string {
  return prompt.length <= 52
    ? prompt
    : `${prompt.slice(0, 49)}…`;
}

export function SimilarityRadar({
  appliedThreshold,
  isApplyingThreshold,
  traces,
  threshold,
  onThresholdChange,
  onThresholdApply,
}: SimilarityRadarProps): JSX.Element {
  const points = useMemo<PlotPoint[]>(
    () =>
      traces
        .filter(isScoredTrace)
        .map((trace) => ({
          ...trace,
          isProjectedHit:
            trace.similarity >= threshold,
          x: scoreToX(trace.similarity),
          y: stableJitter(trace.id),
        })),
    [threshold, traces],
  );

  const appliedThresholdX =
    scoreToX(appliedThreshold);

  const previewThresholdX =
    scoreToX(threshold);

  const hasPendingThreshold =
    Math.abs(threshold - appliedThreshold) >= 0.001;

  const projectedHits = points.filter(
    (point) => point.isProjectedHit,
  ).length;

  const projectedMisses =
    points.length - projectedHits;

  const recentPoints = points.slice(0, 5);

  return (
    <section aria-labelledby="radar-heading">
      <header className="mb-5">
        <h2
          className="font-display text-2xl italic"
          id="radar-heading"
        >
          Similarity threshold plot
        </h2>

        <p className="ui-label mt-1 text-[var(--text-faint)]">
          Position carries meaning / left 0.0 / right 1.0
        </p>
      </header>

      <div className="grid grid-cols-3 border-y border-[var(--hairline)]">
        <div className="border-r border-[var(--hairline)] px-3 py-3">
          <p className="ui-label text-[var(--text-faint)]">
            Scored
          </p>

          <p className="font-data mt-1 text-lg">
            {points.length}
          </p>
        </div>

        <div className="border-r border-[var(--hairline)] px-3 py-3">
          <p className="ui-label text-[var(--text-faint)]">
            Projected hits
          </p>

          <p className="font-data mt-1 text-lg text-[var(--gold)]">
            {projectedHits}
          </p>
        </div>

        <div className="px-3 py-3">
          <p className="ui-label text-[var(--text-faint)]">
            Projected misses
          </p>

          <p className="font-data mt-1 text-lg text-[var(--coral)]">
            {projectedMisses}
          </p>
        </div>
      </div>

      <p className="font-data mt-4 text-[10px] text-[var(--text-faint)]">
        {points.length} of {traces.length} traces plotted
      </p>

      {points.length === 0 && (
        <p className="mt-3 border-l border-[var(--gold)] pl-3 text-xs leading-5 text-[var(--text-muted)]">
          No scored comparison yet. The first query
          seeds the cache; the next query is the first
          one that can produce a similarity score.
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <svg
          aria-label={`${points.length} of ${traces.length} recent traces plotted on a zero-to-one similarity scale`}
          className="block min-w-[520px] w-full"
          role="img"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        >
          <rect
            fill="rgba(194, 96, 74, 0.07)"
            height={PLOT_BOTTOM - PLOT_TOP}
            width={scoreToX(0.75) - PLOT_LEFT}
            x={PLOT_LEFT}
            y={PLOT_TOP}
          />

          <rect
            fill="rgba(234, 230, 221, 0.025)"
            height={PLOT_BOTTOM - PLOT_TOP}
            width={
              scoreToX(0.9) - scoreToX(0.75)
            }
            x={scoreToX(0.75)}
            y={PLOT_TOP}
          />

          <rect
            fill="rgba(212, 161, 90, 0.07)"
            height={PLOT_BOTTOM - PLOT_TOP}
            width={PLOT_RIGHT - scoreToX(0.9)}
            x={scoreToX(0.9)}
            y={PLOT_TOP}
          />

          <text
            fill="var(--text-faint)"
            fontFamily="IBM Plex Mono"
            fontSize="9"
            x={PLOT_LEFT + 8}
            y={PLOT_TOP + 15}
          >
            WEAK
          </text>

          <text
            fill="var(--text-faint)"
            fontFamily="IBM Plex Mono"
            fontSize="9"
            x={scoreToX(0.75) + 8}
            y={PLOT_TOP + 15}
          >
            REVIEW
          </text>

          <text
            fill="var(--text-faint)"
            fontFamily="IBM Plex Mono"
            fontSize="9"
            x={scoreToX(0.9) + 8}
            y={PLOT_TOP + 15}
          >
            STRONG
          </text>

          {FIXED_TICKS.map((tick) => {
            const x = scoreToX(tick);

            return (
              <g key={tick}>
                <line
                  stroke="var(--hairline)"
                  x1={x}
                  x2={x}
                  y1={PLOT_TOP}
                  y2={AXIS_Y}
                />

                <text
                  fill="var(--text-faint)"
                  fontFamily="IBM Plex Mono"
                  fontSize="9"
                  textAnchor="middle"
                  x={x}
                  y={AXIS_Y + 18}
                >
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          <line
            stroke="var(--text-muted)"
            strokeWidth="1"
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={AXIS_Y}
            y2={AXIS_Y}
          />

          <line
            stroke="var(--gold)"
            strokeWidth="2"
            x1={appliedThresholdX}
            x2={appliedThresholdX}
            y1={PLOT_TOP - 13}
            y2={AXIS_Y}
          />

          <text
            fill="var(--gold)"
            fontFamily="IBM Plex Mono"
            fontSize="9"
            textAnchor="middle"
            x={appliedThresholdX}
            y={PLOT_TOP - 20}
          >
            BACKEND {appliedThreshold.toFixed(2)}
          </text>

          {hasPendingThreshold && (
            <>
              <line
                stroke="var(--teal)"
                strokeDasharray="5 4"
                strokeWidth="2"
                x1={previewThresholdX}
                x2={previewThresholdX}
                y1={PLOT_TOP}
                y2={AXIS_Y}
              />

              <text
                fill="var(--teal)"
                fontFamily="IBM Plex Mono"
                fontSize="9"
                textAnchor="middle"
                x={previewThresholdX}
                y={AXIS_Y + 32}
              >
                PREVIEW {threshold.toFixed(2)}
              </text>
            </>
          )}

          {points.map((point, index) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              data-testid="similarity-point"
              data-trace-id={point.id}
              fill={
                point.isProjectedHit
                  ? "var(--gold)"
                  : "var(--coral)"
              }
              r={index === 0 ? "7" : "5"}
              stroke="var(--ink)"
              strokeWidth="2"
            >
              <title>
                {point.similarity.toFixed(3)} /
                projected{" "}
                {point.isProjectedHit
                  ? "HIT"
                  : "MISS"}{" "}
                / actual{" "}
                {point.actualCacheHit
                  ? "HIT"
                  : "MISS"}{" "}
                / {point.prompt}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      {recentPoints.length > 0 && (
        <div className="mt-4">
          <div className="ui-label grid grid-cols-[minmax(0,1fr)_58px_52px] gap-3 border-b border-[var(--hairline)] pb-2 text-[var(--text-faint)]">
            <span>Recent scored query</span>
            <span className="text-right">
              Score
            </span>
            <span className="text-right">
              Preview
            </span>
          </div>

          {recentPoints.map((point) => (
            <div
              key={point.id}
              className="font-data grid grid-cols-[minmax(0,1fr)_58px_52px] gap-3 border-b border-[rgba(234,230,221,0.05)] py-2.5 text-[10px]"
            >
              <span
                className="truncate text-[var(--text-muted)]"
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
                {point.isProjectedHit
                  ? "HIT"
                  : "MISS"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <label
            className="ui-label text-[var(--text-muted)]"
            htmlFor="projection-threshold"
          >
            Projection threshold
          </label>

          <div className="font-data flex gap-4 text-[10px]">
            <span className="text-[var(--teal)]">
              Preview {threshold.toFixed(2)}
            </span>

            <span className="text-[var(--gold)]">
              Backend applied{" "}
              {appliedThreshold.toFixed(2)}
            </span>
          </div>
        </div>

        <input
          aria-describedby="threshold-note"
          className="threshold-range"
          id="projection-threshold"
          max="1"
          min="0"
          step="0.01"
          type="range"
          value={threshold}
          onChange={(event) =>
            onThresholdChange(
              Number(event.target.value),
            )
          }
        />

        <div className="font-data mt-3 flex justify-between text-[10px] text-[var(--text-faint)]">
          <span>0.00 / permissive</span>
          <span>1.00 / exact</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="ui-label border border-[var(--gold)] px-3 py-2 text-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={
              !hasPendingThreshold ||
              isApplyingThreshold
            }
            type="button"
            onClick={() =>
              onThresholdApply(threshold)
            }
          >
            {isApplyingThreshold
              ? "Applying"
              : "Apply to cache"}
          </button>

          <button
            className="ui-label border-b border-[var(--teal)] px-1 py-2 text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={
              !hasPendingThreshold ||
              isApplyingThreshold
            }
            type="button"
            onClick={() =>
              onThresholdChange(appliedThreshold)
            }
          >
            Reset preview
          </button>
        </div>

        <p
          className="mt-5 max-w-xl text-xs leading-5 text-[var(--text-muted)]"
          id="threshold-note"
        >
          Every dot sits at its real similarity score.
          Vertical position only prevents overlap. Moving
          the slider previews which scored traces would
          qualify; it does not change backend behavior
          until you select Apply to cache.
        </p>
      </div>
    </section>
  );
}