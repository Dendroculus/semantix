import { useCallback, useEffect, useState } from "react";

import { getRuntimeMetrics } from "../api/metricsApi";
import type { RuntimeMetrics } from "../types";
import type { ApiError } from "@/shared/api/types";

const REFRESH_INTERVAL_MS = 5_000;

type MetricsState =
  | { status: "loading" }
  | { status: "ready"; data: RuntimeMetrics }
  | { status: "error"; error: ApiError };

interface RuntimeMetricsController {
  state: MetricsState;
  refresh: () => void;
}

export function useRuntimeMetrics(): RuntimeMetricsController {
  const [state, setState] = useState<MetricsState>({
    status: "loading",
  });

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      const result = await getRuntimeMetrics(signal);
      if (result.ok) {
        setState({ status: "ready", data: result.data });
      } else if (!signal?.aborted) {
        setState({ status: "error", error: result.error });
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch(() => undefined);
    const interval = window.setInterval(() => {
      load(controller.signal).catch(() => undefined);
    }, REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [load]);

  const refresh = useCallback((): void => {
    load().catch(() => undefined);
  }, [load]);

  return { state, refresh };
}
