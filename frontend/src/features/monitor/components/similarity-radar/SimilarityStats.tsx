interface SimilarityStatsProps {
  projectedHits: number;
  projectedMisses: number;
  scoredCount: number;
}

export function SimilarityStats({
  projectedHits,
  projectedMisses,
  scoredCount,
}: Readonly<SimilarityStatsProps>): JSX.Element {
  return (
    <div className="grid grid-cols-3 border-y border-(--hairline)">
      <div className="border-r border-(--hairline) p-3 ">
        <p className="ui-label text-(--text-faint)">
          Scored
        </p>
        <p className="font-data mt-1 text-lg">
          {scoredCount}
        </p>
      </div>

      <div className="border-r border-(--hairline) p-3 ">
        <p className="ui-label text-(--text-faint)">
          Projected hits
        </p>
        <p className="font-data mt-1 text-lg text-(--gold)">
          {projectedHits}
        </p>
      </div>

      <div className="p-3 ">
        <p className="ui-label text-(--text-faint)">
          Projected misses
        </p>
        <p className="font-data mt-1 text-lg text-(--coral)">
          {projectedMisses}
        </p>
      </div>
    </div>
  );
}
