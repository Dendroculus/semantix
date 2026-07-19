import { Alert, EmptyState, PageHeader } from '@/shared/components/ui';
import { useBenchmark } from '../hooks/useBenchmark';
import { BenchmarkCharts } from './BenchmarkCharts';
import { BenchmarkControls } from './BenchmarkControls';
import { BenchmarkExports } from './BenchmarkExports';
import { BenchmarkResultsTable } from './BenchmarkResultsTable';
import { BenchmarkResultsSkeleton } from './BenchmarkResultsSkeleton';
import { BenchmarkRunWarning } from './BenchmarkRunWarning';
import { BenchmarkSummary } from './BenchmarkSummary';

export function BenchmarkDashboard(): JSX.Element {
  const controller = useBenchmark();
  const {
    datasetsLoading,
    error,
    isRunning,
    result,
    selectedDataset,
    showWarning,
  } = controller;

  return (
    <section aria-labelledby="benchmark-heading" className="pb-4">
      <PageHeader
        actions={
          result !== null ? <BenchmarkExports result={result} /> : undefined
        }
        className="mb-7"
        description="Measure cache quality, latency, provider savings, and threshold trade-offs against prompts with explicit expected decisions."
        eyebrow="Controlled evaluation"
        headingId="benchmark-heading"
        title="Benchmark laboratory"
      />

      <BenchmarkControls controller={controller} />

      {selectedDataset !== null && (
        <p className="font-data mt-3 text-[10px]/5 text-(--text-faint)">
          {selectedDataset.description}
        </p>
      )}

      <BenchmarkRunWarning controller={controller} />

      {isRunning && <BenchmarkResultsSkeleton />}

      {error !== null && (
        <Alert
          className="mt-6 border-l-2 border-(--coral) bg-[rgba(194,96,74,0.06)] px-4 py-3"
          role="alert"
          title="Benchmark failed"
          tone="error"
        >
          <p className="font-data mt-1 text-[11px]/5 text-(--text-soft)">
            {error}
          </p>
        </Alert>
      )}

      {!datasetsLoading &&
        result === null &&
        !isRunning &&
        !showWarning &&
        error === null && (
          <EmptyState
            className="mt-8 py-6"
            description="Review the selected dataset and threshold to see the expected provider work before starting a controlled run."
            title="No measured run yet"
          />
        )}

      {result !== null && (
        <>
          <BenchmarkSummary result={result} />
          <BenchmarkCharts result={result} />
          <BenchmarkResultsTable results={result.query_results} />
        </>
      )}
    </section>
  );
}
