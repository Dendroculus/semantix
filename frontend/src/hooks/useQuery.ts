import { useCallback, useEffect, useRef, useState } from "react";

import { submitQuery } from "../services/apiClient";
import type { QueryState } from "../types/api";

export interface UseQueryResult {
  state: QueryState;
  submit: (prompt: string) => Promise<boolean>;
  reset: () => void;
}

export function useQuery(): UseQueryResult {
  const [state, setState] = useState<QueryState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  const submit = useCallback(async (prompt: string): Promise<boolean> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setState({ status: "loading" });

    const result = await submitQuery({ prompt }, controller.signal);
    if (requestId !== requestIdRef.current) {
      return false;
    }
    if (result.ok) {
      setState({ status: "success", data: result.data });
      return true;
    }
    setState({ status: "error", error: result.error });
    return false;
  }, []);

  const reset = useCallback((): void => {
    controllerRef.current?.abort();
    requestIdRef.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, submit, reset };
}
