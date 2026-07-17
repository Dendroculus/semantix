import { useEffect, useState } from "react";

import {
  clearCache,
  deleteCacheEntry,
  listCacheEntries,
} from "../../services/apiClient";
import type {
  CacheEntryListResponse,
  CacheEntrySort,
} from "../../types/api";

const PAGE_SIZE = 10;

export type CacheMutation = "delete" | "clear";

interface UseCacheInspectorOptions {
  onMutation: (mutation: CacheMutation) => void;
  refreshKey: number;
}

export interface CacheInspectorController {
  actionError: string | null;
  cancelClear: () => void;
  cancelDelete: () => void;
  confirmClear: boolean;
  confirmClearCache: () => Promise<void>;
  confirmDeleteEntry: (cacheKey: string) => Promise<void>;
  data: CacheEntryListResponse | null;
  hasNext: boolean;
  hasPrevious: boolean;
  isClearing: boolean;
  isLoading: boolean;
  isMutating: boolean;
  loadError: string | null;
  mutation: "clear" | string | null;
  nextPage: () => void;
  pendingDelete: string | null;
  previousPage: () => void;
  refresh: () => void;
  requestClear: () => void;
  requestDelete: (cacheKey: string) => void;
  search: string;
  setSearch: (search: string) => void;
  setSort: (sort: CacheEntrySort) => void;
  sort: CacheEntrySort;
  visibleEnd: number;
  visibleStart: number;
}

export function useCacheInspector({
  onMutation,
  refreshKey,
}: UseCacheInspectorOptions): CacheInspectorController {
  const [data, setData] =
    useState<CacheEntryListResponse | null>(null);
  const [search, setSearchState] = useState("");
  const [sort, setSortState] =
    useState<CacheEntrySort>("newest");
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] =
    useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mutation, setMutation] =
    useState<"clear" | string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);

      const result = await listCacheEntries(
        {
          offset,
          limit: PAGE_SIZE,
          search,
          sort,
        },
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setData(result.data);
      } else {
        setLoadError(
          result.error.detail ??
            "Cache inspector data could not be loaded.",
        );
      }

      setIsLoading(false);
    }

    void load();
    return () => controller.abort();
  }, [offset, refreshKey, reloadKey, search, sort]);

  function refreshFromStart(): void {
    setOffset(0);
    setReloadKey((current) => current + 1);
  }

  function refresh(): void {
    setReloadKey((current) => current + 1);
  }

  function setSearch(nextSearch: string): void {
    setSearchState(nextSearch);
    setOffset(0);
    setPendingDelete(null);
  }

  function setSort(nextSort: CacheEntrySort): void {
    setSortState(nextSort);
    setOffset(0);
    setPendingDelete(null);
  }

  function requestClear(): void {
    setPendingDelete(null);
    setConfirmClear(true);
  }

  function cancelClear(): void {
    setConfirmClear(false);
  }

  function requestDelete(cacheKey: string): void {
    setConfirmClear(false);
    setPendingDelete(cacheKey);
  }

  function cancelDelete(): void {
    setPendingDelete(null);
  }

  async function confirmDeleteEntry(
    cacheKey: string,
  ): Promise<void> {
    setMutation(cacheKey);
    setActionError(null);

    const result = await deleteCacheEntry(cacheKey);
    setMutation(null);

    if (!result.ok) {
      setActionError(
        result.error.detail ?? "The cache entry was not deleted.",
      );
      return;
    }

    setPendingDelete(null);
    refreshFromStart();
    onMutation("delete");
  }

  async function confirmClearCache(): Promise<void> {
    setMutation("clear");
    setActionError(null);

    const result = await clearCache();
    setMutation(null);

    if (!result.ok) {
      setActionError(
        result.error.detail ?? "The cache was not cleared.",
      );
      return;
    }

    setConfirmClear(false);
    setPendingDelete(null);
    refreshFromStart();
    onMutation("clear");
  }

  const visibleStart =
    data === null || data.total === 0 ? 0 : data.offset + 1;
  const visibleEnd =
    data === null
      ? 0
      : Math.min(data.offset + data.items.length, data.total);

  return {
    actionError,
    cancelClear,
    cancelDelete,
    confirmClear,
    confirmClearCache,
    confirmDeleteEntry,
    data,
    hasNext: data?.has_more ?? false,
    hasPrevious: data !== null && data.offset > 0,
    isClearing: mutation === "clear",
    isLoading,
    isMutating: mutation !== null,
    loadError,
    mutation,
    nextPage: () => setOffset((current) => current + PAGE_SIZE),
    pendingDelete,
    previousPage: () =>
      setOffset((current) => Math.max(0, current - PAGE_SIZE)),
    refresh,
    requestClear,
    requestDelete,
    search,
    setSearch,
    setSort,
    sort,
    visibleEnd,
    visibleStart,
  };
}
