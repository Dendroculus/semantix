import type { BenchmarkController } from "../hooks/useBenchmark";

interface BenchmarkRunWarningProps {
  controller: BenchmarkController;
}

export function BenchmarkRunWarning({
  controller,
}: BenchmarkRunWarningProps): JSX.Element | null {
  if (!controller.showWarning) {
    return null;
  }

  const dataset = controller.selectedDataset;
  const queryCount =
    (dataset?.query_count ?? 0) * controller.form.repetitions;
  const expectedProviderCalls =
    (dataset?.expected_misses ?? 0) * controller.form.repetitions;

  return (
    <div
      aria-labelledby="benchmark-warning-title"
      className="mt-5 border border-(--coral) bg-[color-mix(in_srgb,var(--coral)_8%,transparent)] p-5"
      role="alertdialog"
    >
      <p
        className="ui-label text-(--coral)"
        id="benchmark-warning-title"
      >
        External provider warning
      </p>
      <p className="mt-3 max-w-3xl text-sm/6  text-(--text-soft)">
        This run sends {queryCount} embedding requests and is expected to make
        about {expectedProviderCalls} external generation calls. Actual calls
        can differ when the classifier makes false-positive or false-negative
        decisions. Provider charges may apply.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="ui-label bg-(--coral) px-4 py-3 text-(--ink)"
          type="button"
          onClick={() => void controller.confirmRun()}
        >
          Run benchmark now
        </button>
        <button
          className="ui-label border border-(--hairline) px-4 py-3 text-(--text-soft)"
          type="button"
          onClick={controller.cancelRun}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
