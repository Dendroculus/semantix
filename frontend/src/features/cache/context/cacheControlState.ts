import { createContext } from "react";

import type { CacheStatsResponse } from "../types";

export interface CacheControlContextValue {
  appliedThreshold: number;
  cacheStats: CacheStatsResponse | null;
  clearControlError: () => void;
  commitThreshold: (value: number) => Promise<void>;
  controlError: string | null;
  isApplyingThreshold: boolean;
  previewThreshold: number;
  refreshCacheState: (syncPreview?: boolean) => Promise<void>;
  setPreviewThreshold: (value: number) => void;
}

export const CacheControlContext =
  createContext<CacheControlContextValue | null>(null);
