import { Alert, Button, PageHeader } from '@/shared/components/ui';
import {
  formatCount,
  formatHoursMinutesDuration,
  formatLatency,
} from '@/shared/lib/formatters';
import {
  RUNTIME_METRICS_REFRESH_INTERVAL_MS,
  useRuntimeMetrics,
} from '../hooks/useRuntimeMetrics';
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
      <PageHeader
        actions={
          <Button
            className="border-(--hairline) bg-(--surface) text-(--text-soft) hover:border-(--gold) hover:text-(--gold) focus-visible:outline-(--gold)"
            size="large"
            variant="secondary"
            onClick={refresh}
          >
            Refresh metrics
          </Button>
        }
        className="border-b border-(--hairline) pb-8"
        description="Query traffic, cache decisions, provider savings, coalescing, latency, and cache lifecycle counters from this backend process."
        eyebrow="Live process telemetry"
        size="large"
        title="Observability"
        tone="teal"
      />

      <div className="mt-8">
        {state.status === 'loading' && <MetricsSkeleton />}

        {state.status === 'error' && (
          <Alert
            className="border border-(--coral) bg-(--surface) p-6"
            title="Metrics unavailable"
            tone="error"
          >
            <p className="mt-3 text-sm text-(--text-muted)">
              {state.error.detail ??
                'The runtime metrics endpoint could not be reached.'}
            </p>
          </Alert>
        )}

        {state.status === 'ready' && (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-(--hairline) pb-4 text-xs text-(--text-faint)">
              <span>
                Auto-refresh:{' '}
                {formatCount(RUNTIME_METRICS_REFRESH_INTERVAL_MS / 1_000)}{' '}
                seconds
              </span>

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
