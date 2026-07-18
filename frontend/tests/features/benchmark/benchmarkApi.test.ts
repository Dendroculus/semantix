import type { MockedFunction } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBenchmarkDatasets,
  runBenchmark,
} from "@/features/benchmark/api/benchmarkApi";

const dataset = {
  dataset_id: "quick",
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
        JSON.stringify({
          run_id: "a".repeat(32),
          started_at: "2026-07-17T10:00:00Z",
          completed_at: "2026-07-17T10:00:01Z",
          dataset,
          threshold: 0.92,
          repetitions: 1,
          reset_cache_before_run: true,
          estimated_cost_per_request_usd: 0,
          estimated_cost_per_1k_tokens_usd: 0,
          metrics: {
            total_queries: 1,
            cache_hits: 0,
            cache_misses: 1,
            provider_calls: 1,
            provider_calls_avoided: 0,
            hit_rate: 0,
            average_latency_ms: 20,
            median_latency_ms: 20,
            p95_latency_ms: 20,
            average_cache_hit_latency_ms: null,
            average_cache_miss_latency_ms: 20,
            estimated_latency_saved_ms: 0,
            estimated_provider_cost_saved_usd: 0,
            estimated_tokens_saved: 0,
            false_positive_hits: 0,
            false_negative_misses: 0,
            precision: 0,
            recall: 0,
            f1_score: 0,
          },
          threshold_evaluations: [0.8, 0.92].map((threshold) => ({
            threshold,
            hit_rate: 0,
            precision: 0,
            recall: 0,
            f1_score: 0,
            average_latency_ms: 20,
            provider_calls_avoided: 0,
            false_positive_hits: 0,
            false_negative_misses: 0,
          })),
          query_results: [
            {
              sequence: 1,
              repetition: 1,
              case_id: "seed",
              category: "seed",
              prompt: "Seed prompt",
              expected_cache_hit: false,
              actual_cache_hit: false,
              correct: true,
              outcome: "true_negative",
              similarity_score: null,
              latency_ms: 20,
              provider_called: true,
              matched_prompt: null,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const response = await runBenchmark({
      dataset_id: "quick",
      threshold: 0.92,
      evaluation_thresholds: [0.8, 0.92],
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
