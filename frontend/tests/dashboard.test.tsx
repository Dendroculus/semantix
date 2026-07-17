import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/App";
import { FieldMetrics } from "../src/components/FieldMetrics";
import { QueryLog } from "../src/components/QueryLog";
import { ResponseCard } from "../src/components/ResponseCard";
import { SimilarityRadar } from "../src/components/SimilarityRadar";
import { useQuery } from "../src/hooks/useQuery";
import { getCacheStats, getCacheThreshold } from "../src/services/apiClient";
import type { QueryTrace } from "../src/types/dashboard";

vi.mock("../src/hooks/useQuery");
vi.mock("../src/services/apiClient");

const traces: QueryTrace[] = [
  {
    id: "scored-hit",
    prompt: "Close match",
    similarity: 0.95,
    latencyMs: 10,
    recordedAt: new Date("2026-07-17T10:00:00Z"),
    actualCacheHit: true,
  },
  {
    id: "scored-miss",
    prompt: "Distant match",
    similarity: 0.4,
    latencyMs: 20,
    recordedAt: new Date("2026-07-17T10:01:00Z"),
    actualCacheHit: false,
  },
  {
    id: "unscored-miss",
    prompt: "First cache query",
    similarity: null,
    latencyMs: 30,
    recordedAt: new Date("2026-07-17T10:02:00Z"),
    actualCacheHit: false,
  },
];

function metricValue(label: string): string | null | undefined {
  const labelElement = screen.getByText(label);
  const row = labelElement.closest("div")?.parentElement;
  return row?.querySelector("dd")?.textContent;
}

describe("dashboard correctness", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "trace-id"),
    });
    vi.mocked(useQuery).mockReturnValue({
      state: { status: "idle" },
      submit: vi.fn().mockResolvedValue(null),
      reset: vi.fn(),
    });
    vi.mocked(getCacheStats).mockResolvedValue({
      ok: true,
      data: { size: 7, hits: 1, misses: 3, hit_rate: 0.25 },
    });
    vi.mocked(getCacheThreshold).mockResolvedValue({
      ok: true,
      data: { threshold: 0.9 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts without simulated radar traces", async () => {
    const { container } = render(<App />);

    expect(await screen.findByText("0 of 0 traces plotted")).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="similarity-point"]')).toHaveLength(0);
  });

  it("preserves an API null similarity when adding an application trace", async () => {
    vi.mocked(useQuery).mockReturnValue({
      state: { status: "idle" },
      submit: vi.fn().mockResolvedValue({
        response: "Generated response",
        cache_hit: false,
        similarity_score: null,
        similarity_threshold: 0.9,
        matched_prompt: null,
        matched_cache_key: null,
        cache_entry_created_at: null,
        cache_entry_age_seconds: null,
        generation_skipped: false,
        provider_called: true,
        latency_ms: 12,
      }),
      reset: vi.fn(),
    });
    const { container } = render(<App />);

    fireEvent.change(screen.getByLabelText("Query text"), {
      target: { value: "First cache query" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));

    expect(await screen.findByText("First cache query")).toBeTruthy();
    expect(screen.getByText("0 of 1 traces plotted")).toBeTruthy();
    expect(screen.getByText("MISS")).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="similarity-point"]')).toHaveLength(0);
  });

  it("plots only scored traces and keeps their positions stable across thresholds", () => {
    const onThresholdChange = vi.fn();
    const onThresholdCommit = vi.fn();
    const { container, rerender } = render(
      <SimilarityRadar
        appliedThreshold={0.9}
        isApplyingThreshold={false}
        traces={traces}
        threshold={0.9}
        onThresholdApply={onThresholdCommit}
        onThresholdChange={onThresholdChange}
      />,
    );

    expect(screen.getByText("2 of 3 traces plotted")).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="similarity-point"]')).toHaveLength(2);
    expect(container.querySelector('[data-trace-id="unscored-miss"]')).toBeNull();

    const point = container.querySelector('[data-trace-id="scored-hit"]');
    const initialPosition = [point?.getAttribute("cx"), point?.getAttribute("cy")];

    rerender(
      <SimilarityRadar
        appliedThreshold={0.9}
        isApplyingThreshold={false}
        traces={traces}
        threshold={0.99}
        onThresholdApply={onThresholdCommit}
        onThresholdChange={onThresholdChange}
      />,
    );

    const rerenderedPoint = container.querySelector('[data-trace-id="scored-hit"]');
    expect([
      rerenderedPoint?.getAttribute("cx"),
      rerenderedPoint?.getAttribute("cy"),
    ]).toEqual(initialPosition);
  });

  it("renders missing similarity as n/a and classifies it as a miss", () => {
    const unscoredTrace = traces[2];
    expect(unscoredTrace).toBeDefined();
    render(
      <QueryLog
        traces={unscoredTrace === undefined ? [] : [unscoredTrace]}
        threshold={0.9}
      />,
    );

    expect(screen.getByText("n/a")).toBeTruthy();
    expect(screen.getByText("MISS")).toBeTruthy();
  });

  it("renders a nullable response similarity as n/a", () => {
    render(
      <ResponseCard
        result={{
          response: "Generated response",
          cache_hit: false,
          similarity_score: null,
          similarity_threshold: 0.9,
          matched_prompt: null,
          matched_cache_key: null,
          cache_entry_created_at: null,
          cache_entry_age_seconds: null,
          generation_skipped: false,
          provider_called: true,
          latency_ms: 12,
        }}
      />,
    );

    const similarityLabel = screen.getByText("Similarity");
    expect(
      similarityLabel.parentElement?.querySelector("dd")?.textContent,
    ).toBe("n/a");
  });

  it("uses scored-only projection and explicit metric formulas", () => {
    render(
      <FieldMetrics
        cacheStats={{ size: 7, hits: 1, misses: 3, hit_rate: 0.25 }}
        isClearing={false}
        threshold={0.9}
        traces={traces}
        onClear={vi.fn()}
      />,
    );

    expect(metricValue("Frontend projected hit rate")).toBe("50.0%");
    expect(metricValue("Actual backend hit rate")).toBe("25.0%");
    expect(metricValue("Scored / unscored queries")).toBe("2 / 1");
    expect(metricValue("Mean latency")).toBe("20.0 ms");
    expect(metricValue("Provider calls (visible)")).toBe("2");
    expect(metricValue("Cache entries")).toBe("7");
    expect(
      screen.getByText(
        "scored visible traces at or above threshold ÷ scored visible traces",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "backend hits ÷ (backend hits + backend misses), since the last reset",
      ),
    ).toBeTruthy();
  });
});
