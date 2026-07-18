import type { CacheStatsResponse } from "@/features/cache/types";
import type { QueryTrace } from "../types";

interface FieldMetricsProps {
  cacheStats: CacheStatsResponse | null;
  threshold: number;
  traces: QueryTrace[];
}

interface MetricRowProps {
  detail: string;
  label: string;
  value: string;
  tone?: "gold" | "teal" | "coral";
}

const TONE_COLOR = {
  gold: "var(--gold)",
  teal: "var(--teal)",
  coral: "var(--coral)",
};

function MetricRow({
  detail,
  label,
  value,
  tone,
}: Readonly<MetricRowProps>): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-(--hairline) py-4">
      <div>
        <dt className="ui-label text-(--text-muted)">{label}</dt>
        <p className="mt-1 max-w-sm text-[11px]/4  text-(--text-faint)">
          {detail}
        </p>
      </div>
      <dd
        className="font-data shrink-0 text-right text-lg tabular-nums"
        style={tone === undefined ? undefined : { color: TONE_COLOR[tone] }}
      >
        {value}
      </dd>
    </div>
  );
}

export function FieldMetrics({
  cacheStats,
  threshold,
  traces,
}: Readonly<FieldMetricsProps>): JSX.Element {
  const scoredTraces = traces.filter((trace) => trace.similarity !== null);
  const unscoredCount = traces.length - scoredTraces.length;
  const projectedHits = scoredTraces.filter(
    (trace) => trace.similarity !== null && trace.similarity >= threshold,
  ).length;
  const projectedHitRate =
    scoredTraces.length === 0 ? null : projectedHits / scoredTraces.length;
  const meanLatency =
    traces.length === 0
      ? null
      : traces.reduce((total, trace) => total + trace.latencyMs, 0) / traces.length;
  const providerCalls = traces.filter((trace) => trace.providerCalled).length;
  const backendRequestCount =
    cacheStats === null ? 0 : cacheStats.hits + cacheStats.misses;
  const backendHitRate =
    cacheStats === null || backendRequestCount === 0
      ? null
      : cacheStats.hits / backendRequestCount;

  return (
    <aside aria-labelledby="metrics-heading">
      <header className="mb-5">
        <h2 className="font-display text-2xl italic" id="metrics-heading">
          Field readings
        </h2>
        <p className="ui-label mt-1 text-(--text-faint)">
          Primary evidence / formulas shown
        </p>
      </header>

      <dl className="border-t border-(--hairline)">
        <MetricRow
          detail="scored visible traces at or above threshold ÷ scored visible traces"
          label="Frontend projected hit rate"
          tone="gold"
          value={
            projectedHitRate === null
              ? "n/a"
              : `${(projectedHitRate * 100).toFixed(1)}%`
          }
        />
        <MetricRow
          detail="backend hits ÷ (backend hits + backend misses), since the last reset"
          label="Actual backend hit rate"
          value={
            backendHitRate === null
              ? "n/a"
              : `${(backendHitRate * 100).toFixed(1)}%`
          }
        />
        <MetricRow
          detail="visible traces with a score ÷ visible traces without a score"
          label="Scored / unscored queries"
          value={`${scoredTraces.length} / ${unscoredCount}`}
        />
        <MetricRow
          detail="sum of visible trace latency ÷ visible traces"
          label="Mean latency"
          tone="teal"
          value={meanLatency === null ? "n/a" : `${meanLatency.toFixed(1)} ms`}
        />
        <MetricRow
          detail="visible successful traces where backend cache_hit is false"
          label="Provider calls (visible)"
          tone="coral"
          value={String(providerCalls)}
        />
        <MetricRow
          detail="current number of entries reported by the backend cache"
          label="Cache entries"
          value={cacheStats === null ? "n/a" : String(cacheStats.size)}
        />
      </dl>

      <p className="mt-5 text-xs/5  text-(--text-muted)">
        Projection changes with the selected threshold and excludes unscored traces.
        Backend hit rate remains the historical accounting record.
      </p>
    </aside>
  );
}
