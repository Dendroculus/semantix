import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getCacheStats,
  getCacheThreshold,
  updateCacheThreshold,
} from "../api/cacheApi";
import type { CacheStatsResponse } from "../types";
import { CacheControlContext } from "./cacheControlState";

interface CacheControlProviderProps {
  children: ReactNode;
}

export function CacheControlProvider({
  children,
}: CacheControlProviderProps): JSX.Element {
  const [appliedThreshold, setAppliedThreshold] = useState(0.92);
  const [previewThreshold, setPreviewThreshold] = useState(0.92);
  const [cacheStats, setCacheStats] =
    useState<CacheStatsResponse | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [isApplyingThreshold, setIsApplyingThreshold] = useState(false);

  const refreshCacheState = useCallback(
    async (syncPreview = false): Promise<void> => {
      const [statsResult, thresholdResult] = await Promise.all([
        getCacheStats(),
        getCacheThreshold(),
      ]);

      if (statsResult.ok) {
        setCacheStats(statsResult.data);
      }

      if (thresholdResult.ok) {
        setAppliedThreshold(thresholdResult.data.threshold);
        if (syncPreview) {
          setPreviewThreshold(thresholdResult.data.threshold);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void refreshCacheState(true);
  }, [refreshCacheState]);

  async function commitThreshold(value: number): Promise<void> {
    setIsApplyingThreshold(true);
    const result = await updateCacheThreshold(value);
    setIsApplyingThreshold(false);

    if (result.ok) {
      setAppliedThreshold(result.data.threshold);
      setPreviewThreshold(result.data.threshold);
      setControlError(null);
      return;
    }

    setControlError("THRESHOLD UPDATE FAILED; THE SERVER VALUE WAS RESTORED");
    await refreshCacheState(true);
  }

  return (
    <CacheControlContext.Provider
      value={{
        appliedThreshold,
        cacheStats,
        clearControlError: () => setControlError(null),
        commitThreshold,
        controlError,
        isApplyingThreshold,
        previewThreshold,
        refreshCacheState,
        setPreviewThreshold,
      }}
    >
      {children}
    </CacheControlContext.Provider>
  );
}
