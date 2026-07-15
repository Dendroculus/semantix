import type { CacheStatsResponse } from "../types/api";
import type { QueryTrace } from "../types/dashboard";

interface FieldMetricsProps {
  cacheStats: CacheStatsResponse | null;
  isClearing: boolean;
  threshold: number;
  traces: QueryTrace[];
  onClear: () => void;
}

interface MetricRowProps {
  label: string;
  value: string;
  tone?: "gold" | "teal" | "coral";
}

const TONE_COLOR = {
  gold: "var(--gold)",
  teal: "var(--teal)",
  coral: "var(--coral)",
};

function MetricRow({ label, value, tone }: MetricRowProps): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-[var(--hairline)] py-4">
      <dt className="ui-label text-[var(--text-muted)]">{label}</dt>
      <dd
        className="font-data text-right text-lg tabular-nums"
        style={tone === undefined ? undefined : { color: TONE_COLOR[tone] }}
      >
        {value}
      </dd>
    </div>
  );
}

export function FieldMetrics({
  cacheStats,
  isClearing,
  threshold,
  traces,
  onClear,
}: FieldMetricsProps): JSX.Element {
  const projectedHits = traces.filter(
    (trace) => trace.similarity >= threshold,
  ).length;
  const projectedMisses = traces.length - projectedHits;
  const projectedHitRate = traces.length === 0 ? 0 : projectedHits / traces.length;
  const meanLatency =
    traces.length === 0
      ? 0
      : traces.reduce((total, trace) => total + trace.latencyMs, 0) / traces.length;

  return (
    <aside aria-labelledby="metrics-heading">
      <header className="mb-5">
        <h2 className="font-display text-2xl italic" id="metrics-heading">
          Field readings
        </h2>
        <p className="ui-label mt-1 text-[var(--text-faint)]">
          Live threshold projection
        </p>
      </header>

      <dl className="border-t border-[var(--hairline)]">
        <MetricRow
          label="Projected hit rate"
          tone="gold"
          value={`${(projectedHitRate * 100).toFixed(1)}%`}
        />
        <MetricRow
          label="Projected hits"
          tone="gold"
          value={String(projectedHits)}
        />
        <MetricRow
          label="Projected misses"
          tone="coral"
          value={String(projectedMisses)}
        />
        <MetricRow
          label="Mean latency"
          tone="teal"
          value={`${meanLatency.toFixed(1)} ms`}
        />
        <MetricRow
          label="Stored entries"
          value={cacheStats === null ? "n/a" : String(cacheStats.size)}
        />
        <MetricRow
          label="Backend hit rate"
          value={
            cacheStats === null
              ? "n/a"
              : `${(cacheStats.hit_rate * 100).toFixed(1)}%`
          }
        />
      </dl>

      <p className="mt-5 text-xs leading-5 text-[var(--text-muted)]">
        Projected values use the visible trace and current radius. Backend values
        remain the accounting record for requests already made.
      </p>

      <button
        className="ui-label mt-6 border-b border-[var(--coral)] pb-1 text-[var(--coral)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral)] disabled:opacity-50"
        disabled={isClearing}
        type="button"
        onClick={onClear}
      >
        {isClearing ? "Clearing store" : "Clear cache + local trace"}
      </button>
    </aside>
  );
}
