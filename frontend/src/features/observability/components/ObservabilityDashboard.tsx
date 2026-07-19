import type { ReactNode } from "react";

import { MetricTile } from "./MetricTile";
import { MetricsSkeleton } from "./MetricsSkeleton";
import { useRuntimeMetrics } from "../hooks/useRuntimeMetrics";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatLatency(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)} ms`;
}

function formatUptime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  return `${hours}h ${minutes}m`;
}

interface MetricGroupProps {
  children: ReactNode;
  title: string;
}

function MetricGroup({
  children,
  title,
}: Readonly<MetricGroupProps>): JSX.Element {
  return (
    <section>
      <h2 className="ui-label text-(--gold)">{title}</h2>
      <dl className="mt-3 flex flex-wrap gap-px border border-(--hairline) bg-(--hairline)">
        {children}
      </dl>
    </section>
  );
}

export function ObservabilityDashboard(): JSX.Element {
  const { state, refresh } = useRuntimeMetrics();

  return (
    <main>
      <header className="flex flex-col gap-5 border-b border-(--hairline) pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-label text-(--teal)">Live process telemetry</p>
          <h1 className="font-display mt-2 text-4xl italic text-(--text) sm:text-5xl">
            Observability
          </h1>
          <p className="mt-3 max-w-2xl text-sm/6 text-(--text-muted)">
            Query traffic, cache decisions, provider savings, coalescing,
            latency, and cache lifecycle counters from this backend process.
          </p>
        </div>
        <button
          className="ui-label border border-(--hairline) bg-(--surface) px-4 py-3 text-(--text-soft) transition-colors hover:border-(--gold) hover:text-(--gold) focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--gold)"
          type="button"
          onClick={refresh}
        >
          Refresh metrics
        </button>
      </header>

      <div className="mt-8">
        {state.status === "loading" && <MetricsSkeleton />}

        {state.status === "error" && (
          <section className="border border-(--coral) bg-(--surface) p-6">
            <p className="ui-label text-(--coral)">Metrics unavailable</p>
            <p className="mt-3 text-sm text-(--text-muted)">
              {state.error.detail ??
                "The runtime metrics endpoint could not be reached."}
            </p>
          </section>
        )}

        {state.status === "ready" && (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-(--hairline) pb-4 text-xs text-(--text-faint)">
              <span>Auto-refresh: 5 seconds</span>
              <span>Process uptime: {formatUptime(state.data.uptime_seconds)}</span>
              <span>
                Samples: {formatCount(state.data.latency_sample_size)}
              </span>
            </div>

            <MetricGroup title="Traffic">
              <MetricTile
                description="Interactive query requests accepted."
                label="Requests"
                value={formatCount(state.data.request_count)}
              />
              <MetricTile
                description="Query workflows that ended with an error."
                label="Errors"
                value={formatCount(state.data.error_count)}
              />
              <MetricTile
                description="Generation attempts made on cache misses."
                label="Provider calls"
                value={formatCount(state.data.provider_calls)}
              />
              <MetricTile
                description="Followers currently sharing an in-flight request."
                label="Coalesced now"
                value={formatCount(
                  state.data.in_flight_coalesced_requests,
                )}
              />
            </MetricGroup>

            <MetricGroup title="Cache">
              <MetricTile
                description="Entries in the active embedding space."
                label="Entries"
                value={formatCount(state.data.cache_size)}
              />
              <MetricTile
                description="Lookups served from cache."
                label="Hits"
                value={formatCount(state.data.cache_hits)}
              />
              <MetricTile
                description="Lookups that required generation."
                label="Misses"
                value={formatCount(state.data.cache_misses)}
              />
              <MetricTile
                description="Entries removed by the size limit."
                label="Evictions"
                value={formatCount(state.data.evictions)}
              />
              <MetricTile
                description="Entries removed after TTL expiry."
                label="Expirations"
                value={formatCount(state.data.expirations)}
              />
            </MetricGroup>

            <MetricGroup title="Latency">
              <MetricTile
                description="Mean latency across completed requests."
                label="Average"
                value={formatLatency(state.data.average_latency_ms)}
              />
              <MetricTile
                description="95th percentile of the bounded recent sample."
                label="P95"
                value={formatLatency(state.data.p95_latency_ms)}
              />
              <MetricTile
                description="Completed requests in the P95 sample window."
                label="Sample size"
                value={formatCount(state.data.latency_sample_size)}
              />
            </MetricGroup>
          </div>
        )}
      </div>
    </main>
  );
}
