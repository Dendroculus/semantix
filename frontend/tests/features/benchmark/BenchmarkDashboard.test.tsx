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
import { QueryTestProvider } from '../QueryTestProvider';
import { createTestQueryClient } from '../queryClient';
import {
  buildBenchmarkCsv,
  buildBenchmarkJson,
} from '@/features/benchmark/lib/exportBuilders';
import {
  getBenchmarkDatasets,
  runBenchmark,
} from '@/features/benchmark/api/benchmarkApi';
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
    expect(screen.getByText('Hit rate vs. threshold')).toBeTruthy();
    expect(screen.getByText('Precision / recall vs. threshold')).toBeTruthy();
    expect(screen.getByText('Similarity-score distribution')).toBeTruthy();
    expect(screen.getByText('Per-query evidence')).toBeTruthy();
    const table = screen.getByRole('table', {
      name: 'Per-query benchmark results',
    });
    for (const header of [
      '#',
      'Category',
      'Query',
      'Expected',
      'Actual',
      'Score',
      'Latency',
      'Outcome',
    ]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(screen.getByText('0.940')).toBeTruthy();
    expect(within(table).getByText('true positive')).toBeTruthy();
    expect(within(table).getByText('10.0 ms')).toBeTruthy();
    expect(screen.getByText('n/a')).toBeTruthy();
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
    expect(screen.queryByLabelText('Benchmark dataset')).toBeNull();
  });

  it('builds complete JSON and CSV exports', () => {
    const json = buildBenchmarkJson(result);
    const csv = buildBenchmarkCsv(result);

    expect(JSON.parse(json)).toEqual(result);
    expect(csv).toContain(
      'sequence,repetition,case_id,category,prompt,expected_cache_hit',
    );
    expect(csv).toContain('duplicate,exact_duplicate');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
