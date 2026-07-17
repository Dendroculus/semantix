import type { MockedFunction } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteCacheEntry,
  listCacheEntries,
} from "../src/services/apiClient";

describe("cache inspector API client", () => {
  let fetchMock: MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests and decodes a searched, sorted inspector page", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              cache_key: "a".repeat(64),
              prompt: "Explain semantic caching",
              response_preview: "A safe response preview",
              created_at: "2026-07-17T10:00:00Z",
              expires_at: "2026-07-17T11:00:00Z",
              remaining_ttl_seconds: 120,
              hit_count: 3,
              last_accessed_at: "2026-07-17T10:30:00Z",
              recency_rank: 1,
              is_expired: false,
            },
          ],
          total: 1,
          offset: 0,
          limit: 10,
          has_more: false,
        }),
        { status: 200 },
      ),
    );

    const result = await listCacheEntries({
      offset: 0,
      limit: 10,
      search: "semantic cache",
      sort: "most_hit",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0]?.hit_count).toBe(3);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/cache/entries?offset=0&limit=10&sort=most_hit&search=semantic+cache",
      ),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("decodes a successful single-entry deletion", async () => {
    const cacheKey = "b".repeat(64);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ deleted: true, cache_key: cacheKey }),
        { status: 200 },
      ),
    );

    const result = await deleteCacheEntry(cacheKey);

    expect(result).toEqual({
      ok: true,
      data: { deleted: true, cache_key: cacheKey },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/cache/entries/${cacheKey}`),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
