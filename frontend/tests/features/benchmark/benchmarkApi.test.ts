import type { MockedFunction } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBenchmarkDatasets,
  runBenchmark,
} from "@/features/benchmark/api/benchmarkApi";
import { benchmarkResult } from "./support";

const dataset = {
  dataset_id: "quick",
  version: "1.0.0",
  digest: "d".repeat(64),
  name: "Quick set",
  description: "Controlled prompts",
  query_count: 1,
  expected_hits: 0,
  expected_misses: 1,
  categories: ["seed"],
};

describe("benchmark API client", () => {
  let fetchMock: MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes benchmark datasets", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          datasets: [dataset],
          default_dataset_id: "quick",
        }),
        { status: 200 },
      ),
    );

    const response = await getBenchmarkDatasets();

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.datasets[0]?.query_count).toBe(1);
    }
  });

  it("submits explicit provider approval and preserves null scores", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(benchmarkResult),
        { status: 200 },
      ),
    );

    const response = await runBenchmark({
      dataset_id: "quick",
      threshold: 0.9,
      evaluation_thresholds: [0.8, 0.9, 0.95],
      repetitions: 1,
      reset_cache_before_run: true,
      estimated_cost_per_request_usd: 0,
      estimated_cost_per_1k_tokens_usd: 0,
      allow_external_provider_calls: true,
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.query_results[0]?.similarity_score).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/benchmarks/run"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"allow_external_provider_calls":true'),
      }),
    );
  });
});
