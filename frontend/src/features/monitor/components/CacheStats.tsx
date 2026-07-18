import { useCallback, useEffect, useState } from "react";

import {
  clearCache,
  getCacheStats,
} from "@/features/cache/api/cacheApi";
import type { CacheStatsResponse } from "@/features/cache/types";
import type { ApiError } from "@/shared/api/types";

interface CacheStatsProps {
  refreshKey: number;
}

type StatsState =
  | { status: "loading" }
  | { status: "ready"; data: CacheStatsResponse }
  | { status: "error"; error: ApiError };

interface StatTileProps {
  label: string;
  value: string;
  tone: "sky" | "emerald" | "violet" | "amber";
}

const TONES: Record<StatTileProps["tone"], string> = {
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
};

function StatTile({ label, value, tone }: StatTileProps): JSX.Element {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3.5">
      <div className="flex items-center gap-2">
        <span className={"h-1.5 w-1.5 rounded-full " + TONES[tone]} />
        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          {label}
        </dt>
      </div>
      <dd className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {value}
      </dd>
    </div>
  );
}

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

  const hitRate = state.status === "ready" ? state.data.hit_rate * 100 : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/65 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Cache health</h2>
          <p className="mt-0.5 text-xs text-slate-500">Live session metrics</p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats()}
          aria-label="Refresh cache statistics"
          className="rounded-lg border border-white/10 p-2 text-slate-500 transition hover:border-sky-400/25 hover:bg-sky-400/5 hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M20 11a8 8 0 1 0-2.3 5.7" />
            <path d="M20 5v6h-6" />
          </svg>
        </button>
      </header>

      <div className="p-5">
        {state.status === "loading" && (
          <div className="grid grid-cols-2 gap-3" aria-label="Loading cache statistics">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-[86px] animate-pulse rounded-xl border border-white/5 bg-white/[0.035]" />
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-xl border border-rose-400/15 bg-rose-400/5 p-4 text-sm text-rose-200">
            <p className="font-medium">Metrics unavailable</p>
            <p className="mt-1 text-xs leading-5 text-rose-200/65">
              {state.error.detail ?? "Cache statistics could not be loaded."}
            </p>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <StatTile label="Entries" value={state.data.size.toLocaleString()} tone="sky" />
              <StatTile label="Hit rate" value={hitRate.toFixed(1) + "%"} tone="emerald" />
              <StatTile label="Hits" value={state.data.hits.toLocaleString()} tone="violet" />
              <StatTile label="Misses" value={state.data.misses.toLocaleString()} tone="amber" />
            </dl>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Efficiency</span>
                <span className="font-medium tabular-nums text-slate-400">
                  {hitRate.toFixed(1)}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-white/5"
                role="progressbar"
                aria-label="Cache hit rate"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(hitRate)}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300 transition-[width] duration-500"
                  style={{ width: Math.min(100, Math.max(0, hitRate)) + "%" }}
                />
              </div>
            </div>
          </>
        )}

        <div className="mt-5 border-t border-white/5 pt-5">
          <button
            type="button"
            disabled={isClearing}
            onClick={() => void handleClear()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-rose-400/25 hover:bg-rose-400/5 hover:text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
            </svg>
            {isClearing ? "Clearing cache..." : "Clear cache"}
          </button>
          <p className="mt-3 text-center text-[11px] leading-4 text-slate-600">
            Clearing removes entries and resets session metrics.
          </p>
        </div>
      </div>
    </section>
  );
}
