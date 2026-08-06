import type { JSX } from 'react';

import { isCacheNamespace } from '@/features/cache/namespace';

import type { BenchmarkController } from '@/features/benchmark/hooks/useBenchmark';
import { BenchmarkDatasetControls } from './BenchmarkDatasetControls';
import { BenchmarkRunOptions } from './BenchmarkRunOptions';
import { BenchmarkSweepControls } from './BenchmarkSweepControls';

interface BenchmarkControlsProps {
  controller: BenchmarkController;
}

export function BenchmarkControls({
  controller,
}: Readonly<BenchmarkControlsProps>): JSX.Element {
  const historyNamespaceValid =
    controller.form.historyNamespace === '' ||
    isCacheNamespace(controller.form.historyNamespace);

  return (
    <div
      className="grid gap-5 border-y border-(--hairline) py-6 sm:grid-cols-2 lg:grid-cols-3"
      data-benchmark-controls
    >
      <BenchmarkDatasetControls
        controller={controller}
        historyNamespaceValid={historyNamespaceValid}
      />
      <BenchmarkRunOptions
        controller={controller}
        historyNamespaceValid={historyNamespaceValid}
      />
      <BenchmarkSweepControls controller={controller} />
    </div>
  );
}
