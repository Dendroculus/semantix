import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import App from "@/App";
import { useQuery } from "@/features/monitor/hooks/useQuery";
import {
  clearCache,
  deleteCacheEntry,
  getCacheStats,
  getCacheThreshold,
  listCacheEntries,
  updateCacheThreshold,
} from "@/features/cache/api/cacheApi";
import { getBenchmarkDatasets } from "@/features/benchmark/api/benchmarkApi";
import { getRuntimeMetrics } from "@/features/observability/api/metricsApi";
import type {
  CacheEntryMetadata,
} from "@/features/cache/types";
import type { QueryResponse } from "@/features/monitor/types";

vi.mock("../../src/features/monitor/hooks/useQuery");
vi.mock("../../src/features/cache/api/cacheApi");
vi.mock("../../src/features/benchmark/api/benchmarkApi");
vi.mock("../../src/features/observability/api/metricsApi");

const queryResponse: QueryResponse = {
  response:
    "Semantic caching reuses answers for meaningfully similar prompts.",
  cache_hit: false,
  similarity_score: 0.88,
  similarity_threshold: 0.9,
  matched_prompt: null,
  matched_cache_key: null,
  cache_entry_created_at: null,
  cache_entry_age_seconds: null,
  generation_skipped: false,
  provider_called: true,
  latency_ms: 125,
};

const cacheEntry: CacheEntryMetadata = {
  cache_key: "a".repeat(64),
  namespace: "default",
  prompt: "Explain semantic caching",
  response_preview: "A cached explanation.",
  created_at: "2026-07-17T09:00:00Z",
  expires_at: "2026-07-17T10:00:00Z",
  remaining_ttl_seconds: 3600,
  hit_count: 0,
  last_accessed_at: null,
  recency_rank: 1,
  is_expired: false,
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("application routing", () => {
  const submit = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "trace-id"),
    });
    vi.mocked(useQuery).mockReturnValue({
      state: { status: "idle" },
      submit,
    });
    submit.mockResolvedValue(queryResponse);

    vi.mocked(getCacheStats).mockResolvedValue({
      ok: true,
      data: { size: 1, hits: 3, misses: 2, hit_rate: 0.6 },
    });
    vi.mocked(getCacheThreshold).mockResolvedValue({
      ok: true,
      data: { threshold: 0.9 },
    });
    vi.mocked(updateCacheThreshold).mockResolvedValue({
      ok: true,
      data: { threshold: 0.8 },
    });
    vi.mocked(listCacheEntries).mockResolvedValue({
      ok: true,
      data: {
        items: [cacheEntry],
        total: 1,
        offset: 0,
        limit: 10,
        has_more: false,
      },
    });
    vi.mocked(deleteCacheEntry).mockResolvedValue({
      ok: true,
      data: { deleted: true, cache_key: cacheEntry.cache_key },
    });
    vi.mocked(clearCache).mockResolvedValue({
      ok: true,
      data: { cleared: true },
    });
    vi.mocked(getBenchmarkDatasets).mockResolvedValue({
      ok: true,
      data: {
        datasets: [
          {
            dataset_id: "quick",
            name: "Quick semantic safety set",
            description: "Controlled prompts.",
            query_count: 8,
            expected_hits: 4,
            expected_misses: 4,
            categories: [
              "seed",
              "exact_duplicate",
              "paraphrase",
              "unrelated",
              "typo",
              "negation",
              "different_intent",
            ],
          },
        ],
        default_dataset_id: "quick",
      },
    });
    vi.mocked(getRuntimeMetrics).mockResolvedValue({
      ok: true,
      data: {
        observed_at: "2026-07-19T08:00:00Z",
        uptime_seconds: 120,
        request_count: 0,
        error_count: 0,
        cache_hits: 0,
        cache_misses: 0,
        provider_calls: 0,
        in_flight_coalesced_requests: 0,
        average_latency_ms: null,
        p95_latency_ms: null,
        latency_sample_size: 0,
        cache_size: 0,
        evictions: 0,
        expirations: 0,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["/", "Probe the cache", "Monitor"],
    ["/cache", "Cache inspector", "Cache"],
    ["/benchmarks", "Benchmark laboratory", "Benchmarks"],
    ["/observability", "Observability", "Observability"],
  ])("renders %s with an active navigation link", async (path, heading, link) => {
    renderAt(path);

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole(
        "heading",
        { level: 1, name: heading },
        { timeout: 3_000 },
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: link })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("renders a useful not-found route", async () => {
    renderAt("/missing");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Signal not found",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Return to Monitor" })
        .getAttribute("href"),
    ).toBe("/");
  });

  it("does not load benchmark data until its route mounts", async () => {
    renderAt("/");

    expect(getBenchmarkDatasets).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Benchmarks" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Benchmark laboratory",
      }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(getBenchmarkDatasets).toHaveBeenCalledOnce(),
    );
  });

  it("opens the mobile menu and closes it after route navigation", async () => {
    renderAt("/");

    const menuButton = screen.getByRole("button", {
      name: "Open primary menu",
    });
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(menuButton);
    expect(
      screen
        .getByRole("button", { name: "Close primary menu" })
        .getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("link", { name: "Cache" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Cache inspector",
    });
    expect(
      screen
        .getByRole("button", { name: "Open primary menu" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("preserves monitor traces and threshold preview during navigation", async () => {
    renderAt("/");

    fireEvent.change(screen.getByLabelText("Query text"), {
      target: { value: cacheEntry.prompt },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByText("01 records");

    fireEvent.change(screen.getByLabelText("Projection threshold"), {
      target: { value: "0.8" },
    });

    fireEvent.click(screen.getByRole("link", { name: "Cache" }));
    await screen.findByRole("heading", {
      level: 1,
      name: "Cache inspector",
    });
    fireEvent.click(screen.getByRole("link", { name: "Monitor" }));

    expect(await screen.findByText("01 records")).toBeTruthy();
    expect(screen.getAllByText(cacheEntry.prompt).length).toBeGreaterThan(0);
    expect(
      (screen.getByLabelText("Projection threshold") as HTMLInputElement)
        .value,
    ).toBe("0.8");
    expect(screen.getByText("Backend applied 0.90")).toBeTruthy();
  });

  it("restores the server threshold and clears a failed update error", async () => {
    vi.mocked(updateCacheThreshold).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "threshold_update_failed",
        detail: "Threshold rejected.",
        status: 500,
      },
    });
    renderAt("/");

    await screen.findByText("Backend applied 0.90");
    fireEvent.change(screen.getByLabelText("Projection threshold"), {
      target: { value: "0.8" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Apply to cache" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "THRESHOLD UPDATE FAILED; THE SERVER VALUE WAS RESTORED",
    );
    await waitFor(() =>
      expect(
        (screen.getByLabelText(
          "Projection threshold",
        ) as HTMLInputElement).value,
      ).toBe("0.9"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refreshes stats after a deletion without clearing monitor traces", async () => {
    renderAt("/");

    fireEvent.change(screen.getByLabelText("Query text"), {
      target: { value: cacheEntry.prompt },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByText("01 records");

    fireEvent.click(screen.getByRole("link", { name: "Cache" }));
    await screen.findByText(cacheEntry.prompt);
    const statsCallsBeforeDelete =
      vi.mocked(getCacheStats).mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", {
        name: `Delete ${cacheEntry.prompt}`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Confirm delete ${cacheEntry.prompt}`,
      }),
    );

    await waitFor(() =>
      expect(getCacheStats).toHaveBeenCalledTimes(
        statsCallsBeforeDelete + 1,
      ),
    );

    fireEvent.click(screen.getByRole("link", { name: "Monitor" }));
    expect(await screen.findByText("01 records")).toBeTruthy();
  });

  it("clears monitor traces after clearing every cache entry", async () => {
    renderAt("/");

    fireEvent.change(screen.getByLabelText("Query text"), {
      target: { value: cacheEntry.prompt },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    await screen.findByText("01 records");

    fireEvent.click(screen.getByRole("link", { name: "Cache" }));
    await screen.findByText(cacheEntry.prompt);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear all entries" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm clear cache" }),
    );
    await waitFor(() => expect(clearCache).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("link", { name: "Monitor" }));
    expect(await screen.findByText("00 records")).toBeTruthy();
  });
});
