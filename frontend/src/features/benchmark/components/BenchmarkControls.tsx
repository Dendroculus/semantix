import type {
  BenchmarkController,
  BenchmarkForm,
} from "../hooks/useBenchmark";

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
  controller.setForm((current) => ({ ...current, ...patch }));
}

export function BenchmarkControls({
  controller,
}: BenchmarkControlsProps): JSX.Element {
  const { datasets, datasetsLoading, form, isRunning } = controller;

  return (
    <div className="grid gap-5 border-y border-(--hairline) py-6 md:grid-cols-3">
      <label className="block">
        <span className="ui-label text-(--text-muted)">Dataset</span>
        <select
          aria-label="Benchmark dataset"
          className="font-data mt-2 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs"
          disabled={datasetsLoading || isRunning}
          value={form.datasetId}
          onChange={(event) =>
            update(controller, {
              datasetId: event.target.value as BenchmarkForm["datasetId"],
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
        <span className="font-data mt-2 flex items-center gap-3">
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
            {form.threshold.toFixed(2)}
          </output>
        </span>
      </label>

      <label className="block">
        <span className="ui-label text-(--text-muted)">Repetitions</span>
        <input
          aria-label="Benchmark repetitions"
          className="font-data mt-2 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs"
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
          className="font-data mt-2 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs"
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
          className="font-data mt-2 w-full border border-(--hairline) bg-(--surface) px-3 py-2 text-xs"
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
        <label className="font-data flex items-center gap-2 text-xs text-(--text-soft)">
          <input
            checked={form.resetCacheBeforeRun}
            disabled={isRunning}
            type="checkbox"
            onChange={(event) =>
              update(controller, {
                resetCacheBeforeRun: event.target.checked,
              })
            }
          />
          Reset isolated benchmark cache first
        </label>
        <button
          className="ui-label border border-(--gold) px-4 py-3 text-(--gold) disabled:cursor-not-allowed disabled:opacity-40"
          disabled={datasetsLoading || isRunning || datasets.length === 0}
          type="button"
          onClick={controller.reviewRun}
        >
          {isRunning ? "Benchmark running…" : "Review benchmark run"}
        </button>
      </div>
    </div>
  );
}
