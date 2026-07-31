import { Button } from '@/shared/components/ui';
import type { BenchmarkController } from '../hooks/useBenchmark';

import type { JSX } from "react";

interface BenchmarkRunWarningProps {
  controller: BenchmarkController;
}

export function BenchmarkRunWarning({
  controller,
}: Readonly<BenchmarkRunWarningProps>): JSX.Element | null {
  if (!controller.showWarning) {
    return null;
  }

  const dataset = controller.selectedDataset;
  const queryCount = (dataset?.query_count ?? 0) * controller.form.repetitions;

  const estimatedProviderCalls =
    (dataset?.expected_misses ?? 0) * controller.form.repetitions;

  return (
    <div
      aria-labelledby="benchmark-warning-title"
      className="mt-5 border border-(--coral) bg-[color-mix(in_srgb,var(--coral)_8%,transparent)] p-5"
      role="alertdialog"
    >
      <p
        className="ui-label text-(--coral-text)"
        id="benchmark-warning-title"
      >
        External provider warning
      </p>

      <p className="mt-3 max-w-3xl text-sm/6 text-(--text-soft)">
        This bounded run executes {queryCount} cases and sends {queryCount}{' '}
        embedding requests. It may make at most {queryCount} external
        generation calls; dataset labels estimate about{' '}
        {estimatedProviderCalls}. Actual calls can differ when cache decisions
        are false positives or false negatives. Provider charges may apply.
      </p>

      <p className="font-data mt-3 text-[10px]/5 text-(--text-faint)">
        One measured run supplies {controller.sweep.thresholds.length}{' '}
        frozen-candidate threshold values. Alternate thresholds do not repeat
        provider work.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="danger" onClick={() => void controller.confirmRun()}>
          Run benchmark now
        </Button>

        <Button
          className="border-(--hairline) text-(--text-soft) hover:border-(--text-muted) hover:text-(--text) focus-visible:outline-(--gold)"
          size="large"
          variant="secondary"
          onClick={controller.cancelRun}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
