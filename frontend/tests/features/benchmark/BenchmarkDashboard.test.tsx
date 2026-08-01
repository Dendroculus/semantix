import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BenchmarkDashboard } from '@/features/benchmark/components/BenchmarkDashboard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { QueryTestProvider } from '../QueryTestProvider';
import { createTestQueryClient } from '../queryClient';
import {
  getBenchmarkDatasets,
  runBenchmark,
} from '@/features/benchmark/api/benchmarkApi';
import { BENCHMARK_DATASET_STALE_TIME_MS } from '@/features/benchmark/hooks/useBenchmark';
import { benchmarkDatasetKeys } from '@/shared/query/queryKeys';
import { deferred } from '../support';
import {
  benchmarkDataset as dataset,
  benchmarkResult as result,
} from './support';

vi.mock('../../../src/features/benchmark/api/benchmarkApi');

async function reviewAndConfirm(): Promise<void> {
  const reviewButton = await screen.findByRole('button', {
    name: 'Review benchmark run',
  });

  fireEvent.click(reviewButton);

  const confirmButton = await screen.findByRole('button', {
    name: 'Run benchmark now',
  });

  await act(async () => {
    fireEvent.click(confirmButton);

    await Promise.resolve();
  });
}

let queryClient: QueryClient;

function renderDashboard() {
  return render(<BenchmarkDashboard />, {
    wrapper: ({ children }: Readonly<{ children: ReactNode }>) => (
      <QueryTestProvider client={queryClient}>
        {children}
      </QueryTestProvider>
    ),
  });
}

describe('BenchmarkDashboard', () => {
  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.mocked(getBenchmarkDatasets).mockResolvedValue({
      ok: true,
      data: {
        datasets: [
          {
            ...dataset,
            categories: [...dataset.categories],
          },
        ],
        default_dataset_id: 'quick',
      },
    });
    vi.mocked(runBenchmark).mockResolvedValue({ ok: true, data: result });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('warns before provider calls and submits the selected threshold', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: 'Review benchmark run' });

    fireEvent.change(screen.getByLabelText('Benchmark threshold'), {
      target: { value: '0.90' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Review benchmark run' }),
    );

    expect(runBenchmark).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'external generation calls',
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Run benchmark now',
        }),
      );

      await Promise.resolve();
    });

    await waitFor(() =>
      expect(runBenchmark).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 0.9,
          dataset_id: 'quick',
          evaluation_thresholds: [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.98],
          allow_external_provider_calls: true,
        }),
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByText('Measured run')).toBeTruthy();
  });

  it('renders metrics, charts, and per-query evidence', async () => {
    renderDashboard();
    await reviewAndConfirm();

    expect(await screen.findByText('Measured run')).toBeTruthy();
    expect(screen.getByText('50.0%')).toBeTruthy();
    expect(
      screen.getByText(
        'Hit rate vs. threshold (frozen-candidate projection)',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Precision / recall vs. threshold (frozen-candidate projection)',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Similarity-score distribution')).toBeTruthy();
    expect(
      screen.getByText('Confusion matrix and case evidence'),
    ).toBeTruthy();
    const table = screen.getByRole('table', {
      name: 'Per-query benchmark results',
    });
    for (const header of [
      'Sequence',
      'Repetition',
      'Case ID',
      'Category',
      'Query',
      'Expected',
      'Actual',
      'Score',
      'Latency',
      'Outcome',
      'Inspect',
    ]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(within(table).getByText('0.940')).toBeTruthy();
    expect(within(table).getByText('true positive')).toBeTruthy();
    expect(within(table).getByText('10.0 ms')).toBeTruthy();
    expect(within(table).getByText('n/a')).toBeTruthy();
  });

  it('shows loading and error states', async () => {
    let resolveRun:
      | ((value: Awaited<ReturnType<typeof runBenchmark>>) => void)
      | undefined;
    vi.mocked(runBenchmark).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    renderDashboard();
    await reviewAndConfirm();

    expect(screen.getByLabelText('Loading benchmark results')).toBeTruthy();
    expect(
      document.querySelectorAll('[data-skeleton-result-metric]'),
    ).toHaveLength(18);
    expect(
      document.querySelectorAll('[data-skeleton-result-chart]'),
    ).toHaveLength(5);
    await act(async () => {
      resolveRun?.({
        ok: false,
        error: {
          code: 'upstream_error',
          detail: 'Provider unavailable',
          status: 502,
        },
      });

      await Promise.resolve();
    });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Provider unavailable',
    );
  });

  it('uses an accessible dataset skeleton only for initial catalog loading', () => {
    vi.mocked(getBenchmarkDatasets).mockReturnValue(
      new Promise(() => undefined),
    );

    renderDashboard();

    expect(
      screen.getByLabelText('Loading benchmark datasets'),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText('Loading benchmark results'),
    ).toBeNull();
    expect(
      document.querySelectorAll('[data-skeleton-control]'),
    ).toHaveLength(6);
    expect(screen.queryByLabelText('Benchmark dataset')).toBeNull();
  });

  it('keeps cached datasets visible during a background refresh', async () => {
    const cachedCatalog = {
      datasets: [
        {
          ...dataset,
          categories: [...dataset.categories],
        },
      ],
      default_dataset_id: 'quick' as const,
    };
    queryClient.setQueryData(
      benchmarkDatasetKeys.catalog(),
      cachedCatalog,
      {
        updatedAt: Date.now() - BENCHMARK_DATASET_STALE_TIME_MS - 1,
      },
    );
    const refresh =
      deferred<Awaited<ReturnType<typeof getBenchmarkDatasets>>>();
    vi.mocked(getBenchmarkDatasets).mockReturnValue(refresh.promise);

    renderDashboard();

    expect(screen.getByLabelText('Benchmark dataset')).toBeTruthy();
    expect(
      screen.queryByLabelText('Loading benchmark datasets'),
    ).toBeNull();
    expect(screen.getByText('Refreshing dataset catalog')).toBeTruthy();
    await waitFor(() => expect(getBenchmarkDatasets).toHaveBeenCalledOnce());

    await act(async () => {
      refresh.resolve({
        ok: true,
        data: cachedCatalog,
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Refreshing dataset catalog'),
      ).toBeNull();
    });
  });

  it('compiles advanced sweep controls into an exact bounded list', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: 'Review benchmark run' });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Advanced frozen-candidate sweep',
      }),
    );
    fireEvent.change(screen.getByLabelText('Threshold sweep start'), {
      target: { value: '0.80' },
    });
    fireEvent.change(screen.getByLabelText('Threshold sweep end'), {
      target: { value: '0.90' },
    });
    fireEvent.change(screen.getByLabelText('Threshold sweep step'), {
      target: { value: '0.05' },
    });

    await reviewAndConfirm();

    await waitFor(() =>
      expect(runBenchmark).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluation_thresholds: [0.8, 0.85, 0.9, 0.92],
        }),
        expect.any(AbortSignal),
      ),
    );
  });

  it('lets viewers inspect metadata but not initiate a run', async () => {
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => false),
      error: null,
      lockedUntil: null,
      logout: vi.fn(),
      retryAccessPolicy: vi.fn(),
      session: {
        name: 'reader',
        role: 'viewer',
        namespaces: ['default'],
      },
      status: 'authenticated',
    });

    renderDashboard();

    const review = await screen.findByRole('button', {
      name: 'Review benchmark run',
    });
    expect((review as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/Operator access is required/),
    ).toBeTruthy();
    expect(screen.getByText(/Dataset version 1.0.0/)).toBeTruthy();
    expect(runBenchmark).not.toHaveBeenCalled();
  });

  it('lets an authenticated operator complete the review flow', async () => {
    vi.mocked(useAuth).mockReturnValue({
      authenticate: vi.fn(async () => false),
      error: null,
      lockedUntil: null,
      logout: vi.fn(),
      retryAccessPolicy: vi.fn(),
      session: {
        name: 'operator',
        role: 'operator',
        namespaces: ['default'],
      },
      status: 'authenticated',
    });

    renderDashboard();
    await reviewAndConfirm();

    await waitFor(() => expect(runBenchmark).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Evaluation run completed/)).toBeTruthy();
  });
});
