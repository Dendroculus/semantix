import type { QueryTrace } from "../types";

interface QueryLogProps {
  traces: QueryTrace[];
  threshold: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour12: false });
}

export function QueryLog({ traces, threshold }: QueryLogProps): JSX.Element {
  return (
    <section className="mt-16 border-t border-(--hairline) pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-6">
        <h2 className="font-display text-2xl italic">Recent query trace</h2>
        <span className="font-data text-[10px] text-(--text-faint)">
          {traces.length.toString().padStart(2, "0")} records
        </span>
      </div>

      {traces.length === 0 ? (
        <p className="font-data border-y border-(--hairline) py-5 text-[11px]/5  text-(--text-muted)">
          NO QUERY TRACES YET / THE FIRST PROBE WILL LAND AT ITS NEAREST CACHE NEIGHBOR
        </p>
      ) : (
        <div>
          <div className="ui-label hidden grid-cols-[90px_72px_minmax(180px,1fr)_72px_90px] gap-4 border-b border-(--hairline) pb-3 text-(--text-faint) min-[760px]:grid">
            <span>Time</span>
            <span>Score</span>
            <span>Query</span>
            <span>Projection</span>
            <span className="text-right">Latency</span>
          </div>

          {traces.map((trace) => {
            const isProjectedHit =
              trace.similarity !== null && trace.similarity >= threshold;

            return (
              <div
                key={trace.id}
                className="font-data grid gap-2 border-b border-[rgba(234,230,221,0.05)] py-4 text-[11px] min-[760px]:grid-cols-[90px_72px_minmax(180px,1fr)_72px_90px] min-[760px]:gap-4 min-[760px]:py-3"
              >
                <div className="flex justify-between gap-4 min-[760px]:contents">
                  <time className="text-(--text-faint)">{formatTime(trace.recordedAt)}</time>
                  <span className="text-(--teal)">
                    {trace.similarity === null ? "n/a" : trace.similarity.toFixed(3)}
                  </span>
                </div>

                <span className="wrap-break-word text-(--text-soft) min-[760px]:truncate">
                  {trace.prompt}
                </span>

                <div className="flex justify-between gap-4 min-[760px]:contents">
                  <span style={{ color: isProjectedHit ? "var(--gold)" : "var(--coral)" }}>
                    {isProjectedHit ? "HIT" : "MISS"}
                  </span>
                  <span className="text-(--text-muted) min-[760px]:text-right">
                    {trace.latencyMs.toFixed(1)} ms
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
