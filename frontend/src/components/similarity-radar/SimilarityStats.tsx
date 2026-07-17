interface SimilarityStatsProps {
  projectedHits: number;
  projectedMisses: number;
  scoredCount: number;
}

export function SimilarityStats({
  projectedHits,
  projectedMisses,
  scoredCount,
}: SimilarityStatsProps): JSX.Element {
  return (
    <div className="grid grid-cols-3 border-y border-[var(--hairline)]">
      <div className="border-r border-[var(--hairline)] px-3 py-3">
        <p className="ui-label text-[var(--text-faint)]">
          Scored
        </p>
        <p className="font-data mt-1 text-lg">
          {scoredCount}
        </p>
      </div>

      <div className="border-r border-[var(--hairline)] px-3 py-3">
        <p className="ui-label text-[var(--text-faint)]">
          Projected hits
        </p>
        <p className="font-data mt-1 text-lg text-[var(--gold)]">
          {projectedHits}
        </p>
      </div>

      <div className="px-3 py-3">
        <p className="ui-label text-[var(--text-faint)]">
          Projected misses
        </p>
        <p className="font-data mt-1 text-lg text-[var(--coral)]">
          {projectedMisses}
        </p>
      </div>
    </div>
  );
}
