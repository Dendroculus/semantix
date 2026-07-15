import type { QueryTrace } from "../types/dashboard";

interface QueryLogProps {
  traces: QueryTrace[];
  threshold: number;
}

export function QueryLog({
  traces,
  threshold,
}: QueryLogProps): JSX.Element {
  return (
    <section className="mt-16 border-t border-[var(--hairline)] pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-6">
        <h2 className="font-display text-2xl italic">
          Recent query trace
        </h2>

        <span className="font-data text-[10px] text-[color:rgba(234,230,221,0.35)]">
          {traces.length.toString().padStart(2, "0")} records
        </span>
      </div>

      {traces.length === 0 ? (
        <p className="font-data border-y border-[var(--hairline)] py-5 text-[11px] leading-5 text-[color:rgba(234,230,221,0.42)]">
          NO QUERY TRACES YET · SEND A PROMPT AND THE FIRST POINT WILL LAND
          WHERE ITS NEAREST CACHE NEIGHBOR PUTS IT
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="ui-label grid grid-cols-[90px_72px_minmax(240px,1fr)_72px_90px] gap-4 border-b border-[var(--hairline)] pb-3 text-[color:rgba(234,230,221,0.35)]">
              <span>Time</span>
              <span>Score</span>
              <span>Query</span>
              <span>Verdict</span>
              <span className="text-right">Latency</span>
            </div>

            {traces.map((trace) => {
              const isHit = trace.similarity >= threshold;

              return (
                <div
                  key={trace.id}
                  className="font-data grid grid-cols-[90px_72px_minmax(240px,1fr)_72px_90px] gap-4 border-b border-[rgba(234,230,221,0.05)] py-3 text-[11px]"
                >
                  <time className="text-[color:rgba(234,230,221,0.35)]">
                    {trace.recordedAt.toLocaleTimeString([], {
                      hour12: false,
                    })}
                  </time>

                  <span className="text-[var(--teal)]">
                    {trace.similarity.toFixed(3)}
                  </span>

                  <span className="truncate text-[color:rgba(234,230,221,0.75)]">
                    {trace.prompt}
                  </span>

                  <span
                    style={{
                      color: isHit ? "var(--gold)" : "var(--coral)",
                    }}
                  >
                    {isHit ? "HIT" : "MISS"}
                  </span>

                  <span className="text-right text-[color:rgba(234,230,221,0.45)]">
                    {trace.latencyMs.toFixed(1)} ms
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}