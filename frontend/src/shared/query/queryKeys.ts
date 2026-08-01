import type { QueryKey } from "@tanstack/react-query";

import type { CacheEntryListParams } from "@/features/cache/types";

const PROTECTED_QUERY_ROOTS = new Set([
  "benchmark-datasets",
  "cache-entries",
  "runtime-metrics",
]);

export const runtimeMetricsKeys = {
  all: ["runtime-metrics"] as const,
  live: () => [...runtimeMetricsKeys.all, "live"] as const,
};

export const cacheEntryKeys = {
  all: ["cache-entries"] as const,
  lists: () => [...cacheEntryKeys.all, "list"] as const,
  details: () => [...cacheEntryKeys.all, "detail"] as const,
  detail: (cacheKey: string) =>
    [...cacheEntryKeys.details(), cacheKey] as const,
  list: (params: CacheEntryListParams) =>
    [
      ...cacheEntryKeys.lists(),
      {
        limit: params.limit,
        namespace: params.namespace.trim(),
        offset: params.offset,
        search: params.search.trim(),
        sort: params.sort,
      },
    ] as const,
};

export const benchmarkDatasetKeys = {
  all: ["benchmark-datasets"] as const,
  catalog: () => [...benchmarkDatasetKeys.all, "catalog"] as const,
  persisted: () => [...benchmarkDatasetKeys.all, "persisted"] as const,
  persistedList: (namespace: string, offset: number, limit: number) =>
    [
      ...benchmarkDatasetKeys.persisted(),
      "list",
      { namespace: namespace.trim(), offset, limit },
    ] as const,
  persistedDetail: (datasetId: string) =>
    [...benchmarkDatasetKeys.persisted(), "detail", datasetId] as const,
};

export function isProtectedQueryKey(queryKey: QueryKey): boolean {
  const root = queryKey[0];

  return typeof root === "string" && PROTECTED_QUERY_ROOTS.has(root);
}
