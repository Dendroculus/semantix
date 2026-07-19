import {
  formatCount,
  formatHoursMinutesDuration,
  formatLatency,
} from '@/shared/lib/formatters';
import { useRuntimeMetrics } from '../hooks/useRuntimeMetrics';
import { MetricsSkeleton } from './MetricsSkeleton';
import { MetricTile } from './MetricTile';

interface MetricItem {
  description: string;
  label: string;
  value: string;
}

interface MetricGroupProps {
  items: MetricItem[];
  title: string;
}

function MetricGroup({
  items,
  title,
}: Readonly<MetricGroupProps>): JSX.Element {
  return (
    <section>
      <h2 className="ui-label text-(--gold)">{title}</h2>
      <dl className="mt-3 flex flex-wrap gap-px border border-(--hairline) bg-(--hairline)">
        {items.map((item) => (
          <MetricTile
            key={item.label}
            description={item.description}
            label={item.label}
            value={item.value}
          />
        ))}
      </dl>
    </section>
  );
}

export function ObservabilityDashboard(): JSX.Element {
  const { state, refresh } = useRuntimeMetrics();

  const metricGroups: MetricGroupProps[] =
    state.status === 'ready'
      ? [
          {
            title: 'Traffic',
            items: [
              {
                description: 'Interactive query requests accepted.',
                label: 'Requests',
                value: formatCount(state.data.request_count),
              },
              {
                description: 'Query workflows that ended with an error.',
                label: 'Errors',
                value: formatCount(state.data.error_count),
              },
              {
                description: 'Generation attempts made on cache misses.',
                label: 'Provider calls',
                value: formatCount(state.data.provider_calls),
              },
              {
                description:
                  'Followers currently sharing an in-flight request.',
                label: 'Coalesced now',
                value: formatCount(state.data.in_flight_coalesced_requests),
              },
            ],
          },
          {
            title: 'Cache',
            items: [
              {
                description: 'Entries in the active embedding space.',
                label: 'Entries',
                value: formatCount(state.data.cache_size),
              },
              {
                description: 'Lookups served from cache.',
                label: 'Hits',
                value: formatCount(state.data.cache_hits),
              },
              {
                description: 'Lookups that required generation.',
                label: 'Misses',
                value: formatCount(state.data.cache_misses),
              },
              {
                description: 'Entries removed by the size limit.',
                label: 'Evictions',
                value: formatCount(state.data.evictions),
              },
              {
                description: 'Entries removed after TTL expiry.',
                label: 'Expirations',
                value: formatCount(state.data.expirations),
              },
            ],
          },
          {
            title: 'Latency',
            items: [
              {
                description: 'Mean latency across completed requests.',
                label: 'Average',
                value: formatLatency(state.data.average_latency_ms),
              },
              {
                description: '95th percentile of the bounded recent sample.',
                label: 'P95',
                value: formatLatency(state.data.p95_latency_ms),
              },
              {
                description: 'Completed requests in the P95 sample window.',
                label: 'Sample size',
                value: formatCount(state.data.latency_sample_size),
              },
            ],
          },
        ]
      : [];

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
        {state.status === 'loading' && <MetricsSkeleton />}

        {state.status === 'error' && (
          <section className="border border-(--coral) bg-(--surface) p-6">
            <p className="ui-label text-(--coral)">Metrics unavailable</p>
            <p className="mt-3 text-sm text-(--text-muted)">
              {state.error.detail ??
                'The runtime metrics endpoint could not be reached.'}
            </p>
          </section>
        )}

        {state.status === 'ready' && (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-(--hairline) pb-4 text-xs text-(--text-faint)">
              <span>Auto-refresh: 5 seconds</span>
              <span>
                Process uptime:{' '}
                {formatHoursMinutesDuration(state.data.uptime_seconds)}
              </span>
              <span>
                Samples: {formatCount(state.data.latency_sample_size)}
              </span>
            </div>

            {metricGroups.map((group) => (
              <MetricGroup
                key={group.title}
                items={group.items}
                title={group.title}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
