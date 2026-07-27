import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getBenchmarkDatasets,
  runBenchmark,
} from "@/features/benchmark/api/benchmarkApi";
import { useBenchmark } from "@/features/benchmark/hooks/useBenchmark";
import { deferred } from "../support";
import { benchmarkDataset, benchmarkResult } from "./support";

vi.mock("@/features/benchmark/api/benchmarkApi");

describe("useBenchmark", () => {
  beforeEach(() => {
    vi.mocked(getBenchmarkDatasets).mockResolvedValue({
      ok: true,
      data: {
        datasets: [benchmarkDataset],
        default_dataset_id: "quick",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the result from the run started last", async () => {
    const olderRun =
      deferred<Awaited<ReturnType<typeof runBenchmark>>>();
    const newerRun =
      deferred<Awaited<ReturnType<typeof runBenchmark>>>();
    vi.mocked(runBenchmark)
      .mockReturnValueOnce(olderRun.promise)
      .mockReturnValueOnce(newerRun.promise);
    const { result } = renderHook(() => useBenchmark());

    await waitFor(() => expect(result.current.datasetsLoading).toBe(false));

    let olderCompletion: Promise<void> | undefined;
    act(() => {
      olderCompletion = result.current.confirmRun();
    });
    let newerCompletion: Promise<void> | undefined;
    act(() => {
      newerCompletion = result.current.confirmRun();
    });

    const olderSignal = vi.mocked(runBenchmark).mock.calls[0]?.[1];
    expect(olderSignal?.aborted).toBe(true);

    await act(async () => {
      newerRun.resolve({
        ok: true,
        data: {
          ...benchmarkResult,
          run_id: "b".repeat(32),
        },
      });
      await newerCompletion;
    });
    expect(result.current.result?.run_id).toBe("b".repeat(32));

    await act(async () => {
      olderRun.resolve({
        ok: true,
        data: benchmarkResult,
      });
      await olderCompletion;
    });
    expect(result.current.result?.run_id).toBe("b".repeat(32));
  });

  it("aborts an active run when the hook unmounts", async () => {
    const pendingRun =
      deferred<Awaited<ReturnType<typeof runBenchmark>>>();
    vi.mocked(runBenchmark).mockReturnValue(pendingRun.promise);
    const { result, unmount } = renderHook(() => useBenchmark());

    await waitFor(() => expect(result.current.datasetsLoading).toBe(false));

    let completion: Promise<void> | undefined;
    act(() => {
      completion = result.current.confirmRun();
    });
    const signal = vi.mocked(runBenchmark).mock.calls[0]?.[1];

    unmount();

    expect(signal?.aborted).toBe(true);
    pendingRun.resolve({
      ok: true,
      data: benchmarkResult,
    });
    await completion;
  });
});
