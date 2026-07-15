import { useCallback, useEffect, useState } from "react";

import { clearCache, getCacheStats } from "../services/apiClient";
import type { ApiError, CacheStatsResponse } from "../types/api";

interface CacheStatsProps {
  refreshKey: number;
}

type StatsState =
  | { status: "loading" }
  | { status: "ready"; data: CacheStatsResponse }
  | { status: "error"; error: ApiError };

export function CacheStats({ refreshKey }: CacheStatsProps): JSX.Element {
  const [state, setState] = useState<StatsState>({ status: "loading" });
  const [isClearing, setIsClearing] = useState(false);

  const loadStats = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const result = await getCacheStats(signal);
    if (result.ok) {
      setState({ status: "ready", data: result.data });
    } else if (!signal?.aborted) {
      setState({ status: "error", error: result.error });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void loadStats(controller.signal);
    return () => controller.abort();
  }, [loadStats, refreshKey]);

  async function handleClear(): Promise<void> {
    setIsClearing(true);
    const result = await clearCache();
    if (result.ok) {
      await loadStats();
    } else {
      setState({ status: "error", error: result.error });
    }
    setIsClearing(false);
  }

  return (
    <section>
      <h2>Cache statistics</h2>
      {state.status === "loading" && <p>Loading statistics...</p>}
      {state.status === "error" && (
        <p role="alert">{state.error.detail ?? "Statistics are unavailable."}</p>
      )}
      {state.status === "ready" && (
        <dl>
          <dt>Entries</dt><dd>{state.data.size}</dd>
          <dt>Hits</dt><dd>{state.data.hits}</dd>
          <dt>Misses</dt><dd>{state.data.misses}</dd>
          <dt>Hit rate</dt><dd>{(state.data.hit_rate * 100).toFixed(1)}%</dd>
        </dl>
      )}
      <button type="button" disabled={isClearing} onClick={() => void handleClear()}>
        {isClearing ? "Clearing..." : "Clear cache"}
      </button>
    </section>
  );
}
