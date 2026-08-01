import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  apiErrorFromUnknown,
  dataFromApiResult,
} from "@/shared/query/apiResult";
import { cacheEntryKeys } from "@/shared/query/queryKeys";

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
  onMutation: (mutation: CacheMutation) => void | Promise<void>;
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
  isRefreshing: boolean;
  loadError: string | null;
  refreshError: string | null;
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

function errorDetail(error: unknown, fallback: string): string {
  return apiErrorFromUnknown(error).detail ?? fallback;
}

export function useCacheInspector({
  onMutation,
}: Readonly<UseCacheInspectorOptions>): CacheInspectorController {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [namespace, setNamespace] = useState("");
  const [sort, setSort] =
    useState<CacheEntrySort>("newest");
  const [offset, setOffset] = useState(0);
  const [actionError, setActionError] =
    useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const params = {
    offset,
    limit: PAGE_SIZE,
    namespace: namespace.trim(),
    search: search.trim(),
    sort,
  };
  const entriesQuery = useQuery({
    queryKey: cacheEntryKeys.list(params),
    queryFn: async ({ signal }) =>
      dataFromApiResult(await listCacheEntries(params, signal)),
    staleTime: 20 * 1_000,
    gcTime: 5 * 60 * 1_000,
  });
  const deleteMutation = useMutation({
    mutationFn: async (cacheKey: string) =>
      dataFromApiResult(await deleteCacheEntry(cacheKey)),
    onSuccess: async (_response, cacheKey) => {
      queryClient.removeQueries({
        queryKey: cacheEntryKeys.detail(cacheKey),
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: cacheEntryKeys.lists(),
      });
    },
  });
  const clearMutation = useMutation({
    mutationFn: async (selectedNamespace: string | undefined) =>
      dataFromApiResult(await clearCache(selectedNamespace)),
    onSuccess: async () => {
      queryClient.removeQueries({
        queryKey: cacheEntryKeys.details(),
      });
      await queryClient.invalidateQueries({
        queryKey: cacheEntryKeys.lists(),
      });
    },
  });

  const data = entriesQuery.data ?? null;
  const loadError =
    data === null && entriesQuery.isError
      ? errorDetail(
          entriesQuery.error,
          "Cache inspector data could not be loaded.",
        )
      : null;
  const refreshError =
    data !== null && entriesQuery.isError
      ? errorDetail(
          entriesQuery.error,
          "Cache inspector data could not be refreshed.",
        )
      : null;
  let mutation: string | null = null;
  if (clearMutation.isPending) {
    mutation = "clear";
  } else if (deleteMutation.isPending) {
    mutation = deleteMutation.variables ?? null;
  }

  function refresh(): void {
    if (!entriesQuery.isFetching) {
      entriesQuery.refetch({ cancelRefetch: false });
    }
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
    setActionError(null);

    try {
      await deleteMutation.mutateAsync(cacheKey);
      setPendingDelete(null);
      setOffset(0);
      await onMutation("delete");
    } catch (error: unknown) {
      setActionError(
        errorDetail(error, "The cache entry was not deleted."),
      );
    }
  }

  async function confirmClearCache(): Promise<void> {
    setActionError(null);

    const selectedNamespace = namespace.trim();
    try {
      await clearMutation.mutateAsync(
        selectedNamespace === "" ? undefined : selectedNamespace,
      );
      setConfirmClear(false);
      setPendingDelete(null);
      setOffset(0);
      await onMutation("clear");
    } catch (error: unknown) {
      setActionError(
        errorDetail(error, "The cache was not cleared."),
      );
    }
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
    isLoading: data === null && entriesQuery.isPending,
    isMutating: mutation !== null,
    isRefreshing: data !== null && entriesQuery.isFetching,
    loadError,
    refreshError,
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
