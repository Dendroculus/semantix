import { useMemo } from "react";

import type { QueryTrace } from "../types/dashboard";

interface SimilarityRadarProps {
  traces: QueryTrace[];
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  onThresholdCommit: (threshold: number) => void;
}

const VIEW_SIZE = 320;
const CENTER = VIEW_SIZE / 2;
const MAX_RADIUS = 144;

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function stableAngle(id: string): number {
  let hash = 0;

  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return ((hash % 360) * Math.PI) / 180;
}

export function SimilarityRadar({
  traces,
  threshold,
  onThresholdChange,
  onThresholdCommit,
}: SimilarityRadarProps): JSX.Element {
  const points = useMemo(
    () =>
      traces.map((trace) => {
        const score = clampScore(trace.similarity);
        const distance = (1 - score) * MAX_RADIUS;
        const angle = stableAngle(trace.id);

        return {
          ...trace,
          x: CENTER + Math.cos(angle) * distance,
          y: CENTER + Math.sin(angle) * distance,
          isHit: score >= threshold,
        };
      }),
    [threshold, traces],
  );

  const thresholdRadius = (1 - threshold) * MAX_RADIUS;

  return (
    <section aria-labelledby="radar-heading">
      <header className="mb-5">
        <h2
          className="font-display text-2xl italic text-[var(--text)]"
          id="radar-heading"
        >
          Similarity radar
        </h2>

        <p className="ui-label mt-1 text-[color:rgba(234,230,221,0.45)]">
          Center 1.0 · edge 0.0
        </p>
      </header>

      <div className="mx-auto w-full max-w-[520px]">
        <svg
          className="block aspect-square w-full"
          role="img"
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          aria-label={`${traces.length} recent queries plotted by cosine similarity`}
        >
          <line
            x1={CENTER}
            y1={16}
            x2={CENTER}
            y2={304}
            stroke="var(--hairline)"
            strokeWidth="1"
          />
          <line
            x1={16}
            y1={CENTER}
            x2={304}
            y2={CENTER}
            stroke="var(--hairline)"
            strokeWidth="1"
          />

          {[36, 72, 108, 144].map((radius) => (
            <circle
              key={radius}
              cx={CENTER}
              cy={CENTER}
              r={radius}
              fill="none"
              stroke="var(--hairline)"
              strokeWidth="1"
            />
          ))}

          <circle
            cx={CENTER}
            cy={CENTER}
            r={thresholdRadius}
            fill="rgba(212, 161, 90, 0.025)"
            stroke="var(--gold)"
            strokeDasharray="4 5"
            strokeOpacity="0.72"
            strokeWidth="1.5"
          />

          <circle
            cx={CENTER}
            cy={CENTER}
            r="2"
            fill="var(--text)"
          />

          {points.map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r="3.25"
              fill={point.isHit ? "var(--gold)" : "var(--coral)"}
            >
              <title>
                {point.similarity.toFixed(3)} ·{" "}
                {point.isHit ? "HIT" : "MISS"} · {point.prompt}
              </title>
            </circle>
          ))}

          <text
            x={CENTER + 5}
            y={CENTER - 7}
            fill="rgba(234,230,221,0.4)"
            fontFamily="IBM Plex Mono"
            fontSize="8"
          >
            1.0
          </text>

          <text
            x={CENTER + 4}
            y="20"
            fill="rgba(234,230,221,0.35)"
            fontFamily="IBM Plex Mono"
            fontSize="8"
          >
            0.0
          </text>
        </svg>

        <div className="mt-5">
          <div className="mb-3 flex items-baseline justify-between">
            <label
              className="ui-label text-[color:rgba(234,230,221,0.55)]"
              htmlFor="cache-threshold"
            >
              Match threshold
            </label>

            <output
              className="font-data text-sm text-[var(--gold)]"
              htmlFor="cache-threshold"
            >
              {threshold.toFixed(2)}
            </output>
          </div>

          <input
            id="cache-threshold"
            className="threshold-range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(event) =>
              onThresholdChange(Number(event.target.value))
            }
            onPointerUp={(event) =>
              onThresholdCommit(Number(event.currentTarget.value))
            }
            onKeyUp={(event) =>
              onThresholdCommit(Number(event.currentTarget.value))
            }
          />

          <div className="font-data mt-3 flex justify-between text-[10px] text-[color:rgba(234,230,221,0.35)]">
            <span>0.00 · permissive</span>
            <span>1.00 · exact</span>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-5 text-[color:rgba(234,230,221,0.48)]">
            The radius is the whole idea — tighten it and the cache gets
            pickier. Points recolor immediately; the backend threshold updates
            when the control is released.
          </p>
        </div>
      </div>
    </section>
  );
}