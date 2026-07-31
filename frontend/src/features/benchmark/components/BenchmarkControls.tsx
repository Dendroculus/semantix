import { useState, type JSX } from 'react';

import { Button } from '@/shared/components/ui';
import { formatDecimal } from '@/shared/lib/formatters';

import type { BenchmarkController, BenchmarkForm } from '../hooks/useBenchmark';

interface BenchmarkControlsProps {
  controller: BenchmarkController;
}

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function update(
  controller: BenchmarkController,
  patch: Partial<BenchmarkForm>,
): void {
  controller.setForm((current) => ({
    ...current,
    ...patch,
  }));
}

export function BenchmarkControls({
  controller,
}: Readonly<BenchmarkControlsProps>): JSX.Element {
  const [isSweepOpen, setIsSweepOpen] = useState(false);
  const {
    canRun,
    datasets,
    datasetsLoading,
    form,
    isRunning,
    sweep,
  } = controller;

  const controlClass =
    'font-data mt-2 min-h-11 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs text-(--text) outline-none transition-colors hover:border-(--text-faint) focus-visible:border-(--gold) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gold) disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      className="grid gap-5 border-y border-(--hairline) py-6 sm:grid-cols-2 lg:grid-cols-3"
      data-benchmark-controls
    >
      <label className="block">
        <span className="ui-label text-(--text-muted)">Dataset</span>

        <select
          aria-label="Benchmark dataset"
          className={controlClass}
          disabled={datasetsLoading || isRunning}
          value={form.datasetId}
          onChange={(event) =>
            update(controller, {
              datasetId: event.target.value as BenchmarkForm['datasetId'],
            })
          }
        >
          {datasets.map((dataset) => (
            <option key={dataset.dataset_id} value={dataset.dataset_id}>
              {dataset.name} ({dataset.query_count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="ui-label text-(--text-muted)">
          Similarity threshold
        </span>

        <span className="font-data mt-2 flex min-h-11 items-center gap-3">
          <input
            aria-label="Benchmark threshold"
            className="threshold-range"
            disabled={isRunning}
            max="0.99"
            min="0.5"
            step="0.01"
            type="range"
            value={form.threshold}
            onChange={(event) =>
              update(controller, {
                threshold: numberValue(event.target.value, form.threshold),
              })
            }
          />

          <output className="w-12 text-right text-xs">
            {formatDecimal(form.threshold, 2)}
          </output>
        </span>
      </label>

      <label className="block">
        <span className="ui-label text-(--text-muted)">Repetitions</span>

        <input
          aria-label="Benchmark repetitions"
          className={controlClass}
          disabled={isRunning}
          max="5"
          min="1"
          type="number"
          value={form.repetitions}
          onChange={(event) =>
            update(controller, {
              repetitions: numberValue(event.target.value, form.repetitions),
            })
          }
        />
      </label>

      <label className="block">
        <span className="ui-label text-(--text-muted)">
          Cost / provider request (USD)
        </span>

        <input
          aria-label="Estimated cost per provider request"
          className={controlClass}
          disabled={isRunning}
          min="0"
          step="0.001"
          type="number"
          value={form.costPerRequestUsd}
          onChange={(event) =>
            update(controller, {
              costPerRequestUsd: numberValue(
                event.target.value,
                form.costPerRequestUsd,
              ),
            })
          }
        />
      </label>

      <label className="block">
        <span className="ui-label text-(--text-muted)">
          Cost / 1K tokens (USD)
        </span>

        <input
          aria-label="Estimated cost per 1K tokens"
          className={controlClass}
          disabled={isRunning}
          min="0"
          step="0.001"
          type="number"
          value={form.costPer1kTokensUsd}
          onChange={(event) =>
            update(controller, {
              costPer1kTokensUsd: numberValue(
                event.target.value,
                form.costPer1kTokensUsd,
              ),
            })
          }
        />
      </label>

      <div className="flex flex-col justify-between gap-4">
        <label className="font-data flex min-h-11 items-center gap-3 text-xs text-(--text-soft)">
          <input
            checked={form.resetCacheBeforeRun}
            className="size-5 accent-(--gold)"
            disabled={isRunning}
            type="checkbox"
            onChange={(event) =>
              update(controller, {
                resetCacheBeforeRun: event.target.checked,
              })
            }
          />

          <span>Reset isolated benchmark cache before each repetition</span>
        </label>

        <Button
          aria-describedby={!canRun ? 'benchmark-run-permission' : undefined}
          className="disabled:opacity-40"
          disabled={
            datasetsLoading ||
            isRunning ||
            datasets.length === 0 ||
            !canRun ||
            sweep.error !== null
          }
          size="large"
          variant="primary"
          onClick={controller.reviewRun}
        >
          {isRunning ? 'Benchmark running...' : 'Review benchmark run'}
        </Button>
      </div>

      <div className="border-t border-(--hairline) pt-5 sm:col-span-2 lg:col-span-3">
        <button
          aria-controls="benchmark-sweep-controls"
          aria-expanded={isSweepOpen}
          className="ui-label flex min-h-11 w-full items-center justify-between gap-4 text-left text-(--gold) outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--gold)"
          type="button"
          onClick={() => setIsSweepOpen((current) => !current)}
        >
          <span>Advanced frozen-candidate sweep</span>
          <span aria-hidden="true">{isSweepOpen ? '-' : '+'}</span>
        </button>

        <p className="font-data mt-2 text-[10px]/5 text-(--text-faint)">
          {sweep.thresholds.length} projected thresholds, including the
          measured value {formatDecimal(form.threshold, 2)}. Alternate values
          reuse observed candidate scores and do not replay cache population.
        </p>

        {isSweepOpen && (
          <div
            className="mt-4 grid gap-4 sm:grid-cols-3"
            id="benchmark-sweep-controls"
          >
            <label className="block">
              <span className="ui-label text-(--text-muted)">Sweep start</span>
              <input
                aria-label="Threshold sweep start"
                className={controlClass}
                disabled={isRunning}
                max="1"
                min="0"
                step="0.01"
                type="number"
                value={form.sweepStart}
                onChange={(event) =>
                  update(controller, {
                    sweepStart: numberValue(
                      event.target.value,
                      form.sweepStart,
                    ),
                  })
                }
              />
            </label>

            <label className="block">
              <span className="ui-label text-(--text-muted)">Sweep end</span>
              <input
                aria-label="Threshold sweep end"
                className={controlClass}
                disabled={isRunning}
                max="1"
                min="0"
                step="0.01"
                type="number"
                value={form.sweepEnd}
                onChange={(event) =>
                  update(controller, {
                    sweepEnd: numberValue(event.target.value, form.sweepEnd),
                  })
                }
              />
            </label>

            <label className="block">
              <span className="ui-label text-(--text-muted)">Sweep step</span>
              <input
                aria-describedby="benchmark-sweep-status"
                aria-label="Threshold sweep step"
                className={controlClass}
                disabled={isRunning}
                max="1"
                min="0.01"
                step="0.01"
                type="number"
                value={form.sweepStep}
                onChange={(event) =>
                  update(controller, {
                    sweepStep: numberValue(event.target.value, form.sweepStep),
                  })
                }
              />
            </label>
          </div>
        )}

        <output
          aria-live="polite"
          className={`font-data mt-3 block text-[10px]/5 ${
            sweep.error === null ? 'text-(--text-faint)' : 'text-(--coral-text)'
          }`}
          id="benchmark-sweep-status"
        >
          {sweep.error ??
            `Explicit list: ${sweep.thresholds
              .map((threshold) => formatDecimal(threshold, 2))
              .join(', ')}`}
        </output>

        {!canRun && (
          <p
            className="font-data mt-3 text-[10px]/5 text-(--coral-text)"
            id="benchmark-run-permission"
          >
            Viewer access can inspect dataset metadata, but Operator access is
            required to initiate provider-backed evaluation runs.
          </p>
        )}
      </div>
    </div>
  );
}
