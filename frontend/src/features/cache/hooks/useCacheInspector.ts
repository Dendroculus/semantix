import { useEffect, useState } from "react";

import {
  clearCache,
  deleteCacheEntry,
  listCacheEntries,
} from "../api/cacheApi";
import type {
  CacheEntryListResponse,
  CacheEntrySort,
} from "../types";

const PAGE_SIZE = 10;

export type CacheMutation = "delete" | "clear";

interface UseCacheInspectorOptions {
  onMutation: (mutation: CacheMutation) => void;
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
  mutation: string | null;
  namespace: string;
  nextPage: () => void;
  pendingDelete: string | null;
  previousPage: () => void;
  refresh: () => void;
  requestClear: () => void;
  requestDelete: (cacheKey: string) => void;
  search: string;
  setSearch: (search: string) => void;
  setNamespace: (namespace: string) => void;
  setSort: (sort: CacheEntrySort) => void;
  sort: CacheEntrySort;
  visibleEnd: number;
  visibleStart: number;
}

export function useCacheInspector({
  onMutation,
}: Readonly<UseCacheInspectorOptions>): CacheInspectorController {
  const [data, setData] =
    useState<CacheEntryListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [namespace, setNamespace] = useState("");
  const [sort, setSort] =
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
  const [mutation, setMutation] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      setIsLoading(true);
      setLoadError(null);

      const result = await listCacheEntries(
        {
          offset,
          limit: PAGE_SIZE,
          namespace,
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
  }, [namespace, offset, reloadKey, search, sort]);

  function refreshFromStart(): void {
    setOffset(0);
    setReloadKey((current) => current + 1);
  }

  function refresh(): void {
    setReloadKey((current) => current + 1);
  }

  function updateSearch(nextSearch: string): void {
    setSearch(nextSearch);
    setOffset(0);
    setPendingDelete(null);
  }

  function updateNamespace(nextNamespace: string): void {
    setNamespace(nextNamespace);
    setOffset(0);
    setConfirmClear(false);
    setPendingDelete(null);
  }

  function updateSort(nextSort: CacheEntrySort): void {
    setSort(nextSort);
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

    const selectedNamespace = namespace.trim();
    const result = await clearCache(
      selectedNamespace === "" ? undefined : selectedNamespace,
    );
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
    namespace,
    nextPage: () => setOffset((current) => current + PAGE_SIZE),
    pendingDelete,
    previousPage: () =>
      setOffset((current) => Math.max(0, current - PAGE_SIZE)),
    refresh,
    requestClear,
    requestDelete,
    search,
    setSearch: updateSearch,
    setNamespace: updateNamespace,
    setSort: updateSort,
    sort,
    visibleEnd,
    visibleStart,
  };
}
