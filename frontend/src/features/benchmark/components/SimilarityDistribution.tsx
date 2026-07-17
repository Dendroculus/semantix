import type { BenchmarkQueryResult } from "../types";

interface SimilarityDistributionProps {
  results: BenchmarkQueryResult[];
}

interface Bin {
  count: number;
  label: string;
}

const BIN_COUNT = 10;

function buildBins(results: BenchmarkQueryResult[]): Bin[] {
  const bins = Array.from({ length: BIN_COUNT }, (_, index) => {
    const minimum = -1 + (index * 2) / BIN_COUNT;
    const maximum = minimum + 2 / BIN_COUNT;
    return {
      count: 0,
      label: `${minimum.toFixed(1)}–${maximum.toFixed(1)}`,
    };
  });
  for (const result of results) {
    if (result.similarity_score === null) {
      continue;
    }
    const index = Math.min(
      BIN_COUNT - 1,
      Math.max(0, Math.floor(((result.similarity_score + 1) / 2) * BIN_COUNT)),
    );
    const bin = bins[index];
    if (bin !== undefined) {
      bin.count += 1;
    }
  }
  return bins;
}

export function SimilarityDistribution({
  results,
}: SimilarityDistributionProps): JSX.Element {
  const bins = buildBins(results);
  const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
  const unscored = results.filter(
    (result) => result.similarity_score === null,
  ).length;

  return (
    <figure className="border-t border-[var(--hairline)] pt-4">
      <figcaption className="ui-label text-[var(--text-muted)]">
        Similarity-score distribution
      </figcaption>
      <div
        aria-label={`Similarity-score distribution with ${unscored} unscored queries`}
        className="mt-5 flex h-32 items-end gap-1"
        role="img"
      >
        {bins.map((bin) => (
          <div
            className="group relative flex h-full min-w-0 flex-1 items-end"
            key={bin.label}
            title={`${bin.label}: ${bin.count}`}
          >
            <div
              className="w-full bg-[var(--teal)] opacity-75"
              style={{
                height: `${Math.max(2, (bin.count / maxCount) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="font-data mt-2 flex justify-between text-[8px] text-[var(--text-faint)]">
        <span>−1.0</span>
        <span>0.0</span>
        <span>1.0</span>
      </div>
      <p className="font-data mt-3 text-[9px] text-[var(--text-faint)]">
        {unscored} unscored seed quer{unscored === 1 ? "y" : "ies"} excluded
        from the histogram.
      </p>
    </figure>
  );
}
