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
const GUIDE_RADII = [36, 72, 108, 144];

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

function isThresholdKey(key: string): boolean {
  return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key);
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
        const similarity = clampScore(trace.similarity);
        const distance = (1 - similarity) * MAX_RADIUS;
        const angle = stableAngle(trace.id);

        return {
          ...trace,
          similarity,
          x: CENTER + Math.cos(angle) * distance,
          y: CENTER + Math.sin(angle) * distance,
          isHit: similarity >= threshold,
        };
      }),
    [threshold, traces],
  );

  const thresholdRadius = (1 - threshold) * MAX_RADIUS;

  return (
    <section aria-labelledby="radar-heading">
      <header className="mb-5">
        <h2 className="font-display text-2xl italic" id="radar-heading">
          Similarity radar
        </h2>
        <p className="ui-label mt-1 text-[var(--text-faint)]">Center 1.0 / edge 0.0</p>
      </header>

      <div className="mx-auto w-full max-w-[520px]">
        <svg
          aria-label={`${traces.length} recent queries plotted by cosine similarity`}
          className="block aspect-square w-full"
          role="img"
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        >
          <line x1={CENTER} x2={CENTER} y1={16} y2={304} stroke="var(--hairline)" />
          <line x1={16} x2={304} y1={CENTER} y2={CENTER} stroke="var(--hairline)" />

          {GUIDE_RADII.map((radius) => (
            <circle
              key={radius}
              cx={CENTER}
              cy={CENTER}
              fill="none"
              r={radius}
              stroke="var(--hairline)"
            />
          ))}

          <circle
            cx={CENTER}
            cy={CENTER}
            fill="rgba(212, 161, 90, 0.025)"
            r={thresholdRadius}
            stroke="var(--gold)"
            strokeDasharray="4 5"
            strokeOpacity="0.78"
            strokeWidth="1.5"
          />

          <circle cx={CENTER} cy={CENTER} fill="var(--text)" r="2" />

          {points.map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              fill={point.isHit ? "var(--gold)" : "var(--coral)"}
              r="3.25"
            >
              <title>
                {point.similarity.toFixed(3)} / {point.isHit ? "HIT" : "MISS"} / {point.prompt}
              </title>
            </circle>
          ))}

          <text
            fill="var(--text-faint)"
            fontFamily="IBM Plex Mono"
            fontSize="8"
            x={CENTER + 5}
            y={CENTER - 7}
          >
            1.0
          </text>
          <text
            fill="var(--text-faint)"
            fontFamily="IBM Plex Mono"
            fontSize="8"
            x={CENTER + 4}
            y="20"
          >
            0.0
          </text>
        </svg>

        <div className="mt-5">
          <div className="mb-3 flex items-baseline justify-between">
            <label className="ui-label text-[var(--text-muted)]" htmlFor="cache-threshold">
              Match threshold
            </label>
            <output className="font-data text-sm text-[var(--gold)]" htmlFor="cache-threshold">
              {threshold.toFixed(2)}
            </output>
          </div>

          <input
            aria-describedby="threshold-note"
            className="threshold-range"
            id="cache-threshold"
            max="1"
            min="0"
            step="0.01"
            type="range"
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
            onKeyUp={(event) => {
              if (isThresholdKey(event.key)) {
                onThresholdCommit(Number(event.currentTarget.value));
              }
            }}
            onPointerUp={(event) => onThresholdCommit(Number(event.currentTarget.value))}
          />

          <div className="font-data mt-3 flex justify-between text-[10px] text-[var(--text-faint)]">
            <span>0.00 / permissive</span>
            <span>1.00 / exact</span>
          </div>

          <p className="mt-5 max-w-xl text-xs leading-5 text-[var(--text-muted)]" id="threshold-note">
            The radius is the whole idea — tighten it and the cache gets pickier.
            Points recolor live; the server value follows when the control is released.
          </p>
        </div>
      </div>
    </section>
  );
}
