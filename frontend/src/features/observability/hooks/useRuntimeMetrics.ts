import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { getRuntimeMetrics } from "../api/metricsApi";
import type { RuntimeMetrics } from "../types";
import type { ApiError } from "@/shared/api/types";

export const RUNTIME_METRICS_REFRESH_INTERVAL_MS = 5_000;

type MetricsState =
  | { status: "loading" }
  | { status: "ready"; data: RuntimeMetrics }
  | { status: "error"; error: ApiError };

interface RuntimeMetricsController {
  isRefreshing: boolean;
  state: MetricsState;
  refresh: () => void;
}

export function useRuntimeMetrics(): RuntimeMetricsController {
  const [state, setState] = useState<MetricsState>({
    status: "loading",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeController = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const requestSequence = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      return;
    }

    const controller = new AbortController();
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    activeController.current = controller;
    inFlight.current = true;
    setIsRefreshing(true);

    try {
      const result = await getRuntimeMetrics(controller.signal);
      if (
        controller.signal.aborted ||
        requestId !== requestSequence.current
      ) {
        return;
      }

      if (result.ok) {
        setState({ status: "ready", data: result.data });
      } else {
        setState({ status: "error", error: result.error });
      }
    } finally {
      if (requestId === requestSequence.current) {
        activeController.current = null;
        inFlight.current = false;
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let timeout: number | null = null;
    let active = true;

    async function poll(): Promise<void> {
      await load();
      if (active) {
        timeout = window.setTimeout(
          () => void poll(),
          RUNTIME_METRICS_REFRESH_INTERVAL_MS,
        );
      }
    }

    void poll();

    return () => {
      active = false;
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      requestSequence.current += 1;
      activeController.current?.abort();
      activeController.current = null;
      inFlight.current = false;
    };
  }, [load]);

  const refresh = useCallback((): void => {
    void load();
  }, [load]);

  return { isRefreshing, state, refresh };
}
