import { useCallback, useEffect, useState } from "react";

import { FieldMetrics } from "./components/FieldMetrics";
import { QueryForm } from "./components/QueryForm";
import { QueryLog } from "./components/QueryLog";
import { ResponseCard } from "./components/ResponseCard";
import { SimilarityRadar } from "./components/SimilarityRadar";
import { useQuery } from "./hooks/useQuery";
import {
  clearCache,
  getCacheStats,
  getCacheThreshold,
  updateCacheThreshold,
} from "./services/apiClient";
import type { CacheStatsResponse } from "./types/api";
import type { QueryTrace } from "./types/dashboard";

function UptimeClock(): JSX.Element {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  const totalSeconds = Math.floor(elapsed / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="text-right">
      <p className="ui-label text-[var(--text-faint)]">Session uptime</p>
      <time className="font-data mt-1 block text-xs">
        {hours.toString().padStart(2, "0")}:
        {minutes.toString().padStart(2, "0")}:
        {seconds.toString().padStart(2, "0")}
      </time>
    </div>
  );
}

export default function App(): JSX.Element {
  const { state, submit } = useQuery();
  const [traces, setTraces] = useState<QueryTrace[]>([]);
  const [threshold, setThreshold] = useState(0.92);
  const [cacheStats, setCacheStats] = useState<CacheStatsResponse | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const refreshCacheState = useCallback(async (): Promise<void> => {
    const [statsResult, thresholdResult] = await Promise.all([
      getCacheStats(),
      getCacheThreshold(),
    ]);

    if (statsResult.ok) {
      setCacheStats(statsResult.data);
    }

    if (thresholdResult.ok) {
      setThreshold(thresholdResult.data.threshold);
    }
  }, []);

  useEffect(() => {
    void refreshCacheState();
  }, [refreshCacheState]);

  async function handleSubmit(prompt: string): Promise<void> {
    const result = await submit(prompt);

    if (result === null) {
      return;
    }

    setTraces((current) =>
      [
        {
          id: crypto.randomUUID(),
          prompt,
          similarity: result.similarity_score ?? 0,
          latencyMs: result.latency_ms,
          recordedAt: new Date(),
          actualCacheHit: result.cache_hit,
        },
        ...current,
      ].slice(0, 40),
    );

    await refreshCacheState();
  }

  async function commitThreshold(value: number): Promise<void> {
    const result = await updateCacheThreshold(value);

    if (result.ok) {
      setThreshold(result.data.threshold);
      setControlError(null);
      return;
    }

    setControlError("THRESHOLD UPDATE FAILED; THE SERVER VALUE WAS RESTORED");
    await refreshCacheState();
  }

  async function handleClearCache(): Promise<void> {
    setIsClearing(true);
    const result = await clearCache();
    setIsClearing(false);

    if (!result.ok) {
      setControlError("CACHE CLEAR FAILED; THE STORE WAS LEFT ALONE");
      return;
    }

    setTraces([]);
    setControlError(null);
    await refreshCacheState();
  }

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-6 text-[var(--text)] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-end justify-between gap-6 border-b border-[var(--hairline)] pb-7">
          <div>
            <p className="ui-label text-[var(--gold)]">Semantix</p>
            <p className="font-display mt-1 text-xl italic text-[var(--text-soft)]">
              Semantic cache field monitor
            </p>
          </div>

          <UptimeClock />
        </header>

        <div className="mb-12 border-b border-[var(--hairline)] pb-10">
          <QueryForm
            isLoading={state.status === "loading"}
            onSubmit={handleSubmit}
          />

          {state.status === "error" && (
            <p className="font-data mt-4 text-[11px] text-[var(--coral)]" role="alert">
              QUERY FAILED / {state.error.detail ?? "THE PROVIDER RETURNED NO DETAIL"}
            </p>
          )}

          {state.status === "success" && (
            <div className="mt-8">
              <ResponseCard result={state.data} />
            </div>
          )}
        </div>

        <main className="grid grid-cols-1 gap-14 min-[760px]:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
          <SimilarityRadar
            traces={traces}
            threshold={threshold}
            onThresholdChange={setThreshold}
            onThresholdCommit={(value) => void commitThreshold(value)}
          />

          <FieldMetrics
            cacheStats={cacheStats}
            isClearing={isClearing}
            threshold={threshold}
            traces={traces}
            onClear={() => void handleClearCache()}
          />
        </main>

        {controlError !== null && (
          <p className="font-data mt-8 text-[11px] text-[var(--coral)]" role="alert">
            {controlError}
          </p>
        )}

        <QueryLog traces={traces} threshold={threshold} />
      </div>
    </div>
  );
}
