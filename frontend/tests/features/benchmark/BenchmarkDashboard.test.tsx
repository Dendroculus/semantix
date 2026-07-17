import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenchmarkDashboard } from "../../../src/features/benchmark/components/BenchmarkDashboard";
import {
  buildBenchmarkCsv,
  buildBenchmarkJson,
} from "../../../src/features/benchmark/lib/exportBuilders";
import {
  getBenchmarkDatasets,
  runBenchmark,
} from "../../../src/features/benchmark/api/benchmarkApi";
import type { BenchmarkRunResponse } from "../../../src/features/benchmark/types";

vi.mock("../../../src/features/benchmark/api/benchmarkApi");

const dataset = {
  dataset_id: "quick" as const,
  name: "Quick semantic safety set",
  description: "Controlled prompts.",
  query_count: 2,
  expected_hits: 1,
  expected_misses: 1,
  categories: ["seed", "exact_duplicate"] as const,
};

const result: BenchmarkRunResponse = {
  run_id: "a".repeat(32),
  started_at: "2026-07-17T10:00:00Z",
  completed_at: "2026-07-17T10:00:02Z",
  dataset: {
    ...dataset,
    categories: [...dataset.categories],
  },
  threshold: 0.9,
  repetitions: 1,
  reset_cache_before_run: true,
  estimated_cost_per_request_usd: 0.01,
  estimated_cost_per_1k_tokens_usd: 0.002,
  metrics: {
    total_queries: 2,
    cache_hits: 1,
    cache_misses: 1,
    provider_calls: 1,
    provider_calls_avoided: 1,
    hit_rate: 0.5,
    average_latency_ms: 55,
    median_latency_ms: 55,
    p95_latency_ms: 95.5,
    average_cache_hit_latency_ms: 10,
    average_cache_miss_latency_ms: 100,
    estimated_latency_saved_ms: 90,
    estimated_provider_cost_saved_usd: 0.0102,
    estimated_tokens_saved: 100,
    false_positive_hits: 0,
    false_negative_misses: 0,
    precision: 1,
    recall: 1,
    f1_score: 1,
  },
  threshold_evaluations: [
    {
      threshold: 0.8,
      hit_rate: 0.5,
      precision: 1,
      recall: 1,
      f1_score: 1,
      average_latency_ms: 55,
      provider_calls_avoided: 1,
      false_positive_hits: 0,
      false_negative_misses: 0,
    },
    {
      threshold: 0.95,
      hit_rate: 0,
      precision: 0,
      recall: 0,
      f1_score: 0,
      average_latency_ms: 100,
      provider_calls_avoided: 0,
      false_positive_hits: 0,
      false_negative_misses: 1,
    },
  ],
  query_results: [
    {
      sequence: 1,
      repetition: 1,
      case_id: "seed",
      category: "seed",
      prompt: "Explain semantic caching.",
      expected_cache_hit: false,
      actual_cache_hit: false,
      correct: true,
      outcome: "true_negative",
      similarity_score: null,
      latency_ms: 100,
      provider_called: true,
      matched_prompt: null,
    },
    {
      sequence: 2,
      repetition: 1,
      case_id: "duplicate",
      category: "exact_duplicate",
      prompt: "Explain semantic caching.",
      expected_cache_hit: true,
      actual_cache_hit: true,
      correct: true,
      outcome: "true_positive",
      similarity_score: 0.94,
      latency_ms: 10,
      provider_called: false,
      matched_prompt: "Explain semantic caching.",
    },
  ],
};

async function reviewAndConfirm(): Promise<void> {
  await screen.findByRole("button", { name: "Review benchmark run" });
  fireEvent.click(screen.getByRole("button", { name: "Review benchmark run" }));
  fireEvent.click(screen.getByRole("button", { name: "Run benchmark now" }));
}

describe("BenchmarkDashboard", () => {
  beforeEach(() => {
    vi.mocked(getBenchmarkDatasets).mockResolvedValue({
      ok: true,
      data: {
        datasets: [
          {
            ...dataset,
            categories: [...dataset.categories],
          },
        ],
        default_dataset_id: "quick",
      },
    });
    vi.mocked(runBenchmark).mockResolvedValue({ ok: true, data: result });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("warns before provider calls and submits the selected threshold", async () => {
    render(<BenchmarkDashboard />);
    await screen.findByRole("button", { name: "Review benchmark run" });

    fireEvent.change(screen.getByLabelText("Benchmark threshold"), {
      target: { value: "0.90" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review benchmark run" }));

    expect(runBenchmark).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "external generation calls",
    );

    fireEvent.click(screen.getByRole("button", { name: "Run benchmark now" }));

    await waitFor(() =>
      expect(runBenchmark).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 0.9,
          dataset_id: "quick",
          allow_external_provider_calls: true,
        }),
      ),
    );
    expect(await screen.findByText("Measured run")).toBeTruthy();
  });

  it("renders metrics, charts, and per-query evidence", async () => {
    render(<BenchmarkDashboard />);
    await reviewAndConfirm();

    expect(await screen.findByText("Measured run")).toBeTruthy();
    expect(screen.getByText("50.0%")).toBeTruthy();
    expect(screen.getByText("Hit rate vs. threshold")).toBeTruthy();
    expect(screen.getByText("Precision / recall vs. threshold")).toBeTruthy();
    expect(screen.getByText("Similarity-score distribution")).toBeTruthy();
    expect(screen.getByText("Per-query evidence")).toBeTruthy();
    expect(screen.getByText("0.940")).toBeTruthy();
    expect(screen.getByText("n/a")).toBeTruthy();
  });

  it("shows loading and error states", async () => {
    let resolveRun:
      | ((value: Awaited<ReturnType<typeof runBenchmark>>) => void)
      | undefined;
    vi.mocked(runBenchmark).mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    render(<BenchmarkDashboard />);
    await reviewAndConfirm();

    expect(screen.getByText(/RUNNING CONTROLLED QUERY SEQUENCE/).textContent).toContain(
      "RUNNING CONTROLLED QUERY SEQUENCE",
    );
    act(() => {
      resolveRun?.({
        ok: false,
        error: {
          code: "upstream_error",
          detail: "Provider unavailable",
          status: 502,
        },
      });
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Provider unavailable",
    );
  });

  it("builds complete JSON and CSV exports", () => {
    const json = buildBenchmarkJson(result);
    const csv = buildBenchmarkCsv(result);

    expect(JSON.parse(json)).toEqual(result);
    expect(csv).toContain(
      "sequence,repetition,case_id,category,prompt,expected_cache_hit",
    );
    expect(csv).toContain("duplicate,exact_duplicate");
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});
