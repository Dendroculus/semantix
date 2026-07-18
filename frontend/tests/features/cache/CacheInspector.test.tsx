import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CacheInspector } from "@/features/cache/components/CacheInspector";
import {
  clearCache,
  deleteCacheEntry,
  listCacheEntries,
} from "@/features/cache/api/cacheApi";
import type {
  CacheEntryListParams,
  CacheEntryMetadata,
} from "@/features/cache/types";

vi.mock("../../../src/features/cache/api/cacheApi");

const alphaEntry: CacheEntryMetadata = {
  cache_key: "a".repeat(64),
  namespace: "tenant-alpha",
  prompt: "Explain semantic caching",
  response_preview: "Semantic caching reuses related responses.",
  created_at: "2026-07-17T10:00:00Z",
  expires_at: "2026-07-17T11:00:00Z",
  remaining_ttl_seconds: 125,
  hit_count: 4,
  last_accessed_at: "2026-07-17T10:30:00Z",
  recency_rank: 1,
  is_expired: false,
};

const betaEntry: CacheEntryMetadata = {
  cache_key: "b".repeat(64),
  namespace: "tenant-beta",
  prompt: "How does cosine similarity work?",
  response_preview: "Cosine similarity compares vector direction.",
  created_at: "2026-07-17T09:00:00Z",
  expires_at: "2026-07-17T10:30:00Z",
  remaining_ttl_seconds: 60,
  hit_count: 1,
  last_accessed_at: null,
  recency_rank: 2,
  is_expired: false,
};

function successfulPage(
  items: CacheEntryMetadata[],
  params: CacheEntryListParams,
) {
  return {
    ok: true as const,
    data: {
      items,
      total: items.length,
      offset: params.offset,
      limit: params.limit,
      has_more: false,
    },
  };
}

describe("CacheInspector", () => {
  beforeEach(() => {
    vi.mocked(listCacheEntries).mockImplementation(async (params) =>
      successfulPage([], params),
    );
    vi.mocked(deleteCacheEntry).mockResolvedValue({
      ok: true,
      data: { deleted: true, cache_key: alphaEntry.cache_key },
    });
    vi.mocked(clearCache).mockResolvedValue({
      ok: true,
      data: { cleared: true },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the empty state", async () => {
    render(<CacheInspector refreshKey={0} onMutation={vi.fn()} />);

    expect(await screen.findByText("The cache is empty.")).toBeTruthy();
    expect(
      screen.getByText("Run a query to create the first inspectable entry."),
    ).toBeTruthy();
  });

  it("renders markdown and math in response previews", async () => {
    const formattedEntry = {
      ...alphaEntry,
      response_preview: [
        "**Formatted preview**",
        "",
        "- First item",
        "- Second item",
        "",
        "Inline math: \\(x^2 + y^2\\)",
      ].join("\n"),
    };
    vi.mocked(listCacheEntries).mockImplementation(async (params) =>
      successfulPage([formattedEntry], params),
    );

    const { container } = render(
      <CacheInspector refreshKey={0} onMutation={vi.fn()} />,
    );

    const strongText = await screen.findByText("Formatted preview");
    expect(strongText.tagName).toBe("STRONG");
    expect(screen.getByText("First item").closest("ul")).not.toBeNull();
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("searches cached prompts through the inspector API", async () => {
    vi.mocked(listCacheEntries).mockImplementation(async (params) => {
      const items = params.search.toLowerCase().includes("semantic")
        ? [alphaEntry]
        : [alphaEntry, betaEntry];
      return successfulPage(items, params);
    });

    render(<CacheInspector refreshKey={0} onMutation={vi.fn()} />);
    expect(await screen.findByText(betaEntry.prompt)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search cached prompts"), {
      target: { value: "semantic" },
    });

    await waitFor(() => {
      expect(listCacheEntries).toHaveBeenCalledWith(
        {
          offset: 0,
          limit: 10,
          namespace: "",
          search: "semantic",
          sort: "newest",
        },
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByText(alphaEntry.prompt)).toBeTruthy();
    expect(screen.queryByText(betaEntry.prompt)).toBeNull();
  });

  it("filters and clears one namespace", async () => {
    let items = [alphaEntry, betaEntry];
    vi.mocked(listCacheEntries).mockImplementation(async (params) => {
      const filtered = params.namespace === ""
        ? items
        : items.filter((entry) => entry.namespace === params.namespace);
      return successfulPage(filtered, params);
    });
    vi.mocked(clearCache).mockImplementation(async (namespace) => {
      items = items.filter((entry) => entry.namespace !== namespace);
      return { ok: true, data: { cleared: true } };
    });

    render(<CacheInspector refreshKey={0} onMutation={vi.fn()} />);
    await screen.findByText(alphaEntry.prompt);

    fireEvent.change(screen.getByLabelText("Namespace"), {
      target: { value: "tenant-alpha" },
    });

    await waitFor(() => {
      expect(listCacheEntries).toHaveBeenCalledWith(
        expect.objectContaining({ namespace: "tenant-alpha" }),
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByText(alphaEntry.prompt)).toBeTruthy();
    expect(screen.queryByText(betaEntry.prompt)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear namespace" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm clear cache" }),
    );

    await waitFor(() => {
      expect(clearCache).toHaveBeenCalledWith("tenant-alpha");
    });
    expect(await screen.findByText("The cache is empty.")).toBeTruthy();
  });

  it("requests every supported sort mode", async () => {
    vi.mocked(listCacheEntries).mockImplementation(async (params) =>
      successfulPage([alphaEntry, betaEntry], params),
    );
    render(<CacheInspector refreshKey={0} onMutation={vi.fn()} />);
    await screen.findByText(alphaEntry.prompt);

    const sortSelect = screen.getByLabelText("Sort cache entries");
    const sorts = ["oldest", "most_hit", "nearest_expiry"] as const;

    expect(listCacheEntries).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest" }),
      expect.any(AbortSignal),
    );

    for (const sort of sorts) {
      fireEvent.change(sortSelect, { target: { value: sort } });
      await waitFor(() => {
        expect(listCacheEntries).toHaveBeenCalledWith(
          expect.objectContaining({ sort }),
          expect.any(AbortSignal),
        );
      });
    }
  });

  it("confirms a single delete and refreshes the listing", async () => {
    let items = [alphaEntry];
    vi.mocked(listCacheEntries).mockImplementation(async (params) =>
      successfulPage(items, params),
    );
    vi.mocked(deleteCacheEntry).mockImplementation(async (cacheKey) => {
      items = [];
      return {
        ok: true,
        data: { deleted: true, cache_key: cacheKey },
      };
    });
    const onMutation = vi.fn();
    render(<CacheInspector refreshKey={0} onMutation={onMutation} />);
    await screen.findByText(alphaEntry.prompt);

    fireEvent.click(
      screen.getByRole("button", { name: `Delete ${alphaEntry.prompt}` }),
    );
    expect(deleteCacheEntry).not.toHaveBeenCalled();
    expect(
      screen.getByRole("group", {
        name: `Confirm deletion of ${alphaEntry.prompt}`,
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: `Confirm delete ${alphaEntry.prompt}`,
      }),
    );

    await waitFor(() => {
      expect(deleteCacheEntry).toHaveBeenCalledWith(alphaEntry.cache_key);
      expect(onMutation).toHaveBeenCalledWith("delete");
    });
    expect(await screen.findByText("The cache is empty.")).toBeTruthy();
    expect(
      vi.mocked(listCacheEntries).mock.calls.length,
    ).toBeGreaterThan(1);
  });

  it("confirms clear-all and refreshes after the mutation", async () => {
    let items = [alphaEntry, betaEntry];
    vi.mocked(listCacheEntries).mockImplementation(async (params) =>
      successfulPage(items, params),
    );
    vi.mocked(clearCache).mockImplementation(async () => {
      items = [];
      return { ok: true, data: { cleared: true } };
    });
    const onMutation = vi.fn();
    render(<CacheInspector refreshKey={0} onMutation={onMutation} />);
    await screen.findByText(alphaEntry.prompt);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear all entries" }),
    );
    expect(clearCache).not.toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: "Confirm clear cache" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm clear cache" }),
    );

    await waitFor(() => {
      expect(clearCache).toHaveBeenCalledTimes(1);
      expect(onMutation).toHaveBeenCalledWith("clear");
    });
    expect(await screen.findByText("The cache is empty.")).toBeTruthy();
    expect(
      vi.mocked(listCacheEntries).mock.calls.length,
    ).toBeGreaterThan(1);
  });
});
