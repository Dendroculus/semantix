import { describe, expect, it } from "vitest";

import {
  formatCompactDuration,
  formatCount,
  formatDecimal,
  formatHoursMinutesDuration,
  formatLatency,
  formatPercent,
  formatSimilarity,
  formatTimestamp,
  formatUsd,
} from "@/shared/lib/formatters";

describe("shared formatters", () => {
  it("formats counts using the runtime locale", () => {
    expect(formatCount(1_000)).toBe(
      new Intl.NumberFormat().format(1_000),
    );
  });

  it("formats missing numeric values with a fallback", () => {
    expect(formatCount(null)).toBe("n/a");
    expect(formatDecimal(undefined, 2)).toBe("n/a");
    expect(formatLatency(Number.NaN)).toBe("n/a");
  });

  it("formats decimals and domain measurements", () => {
    expect(formatDecimal(0.9234, 2)).toBe("0.92");
    expect(formatPercent(0.5)).toBe("50.0%");
    expect(formatLatency(12)).toBe("12.0 ms");
    expect(formatSimilarity(0.94567)).toBe("0.946");
    expect(formatUsd(0.01025)).toBe("$0.0103");
  });

  it("formats compact durations", () => {
    expect(formatCompactDuration(null)).toBe("n/a");
    expect(
      formatCompactDuration(null, {
        fallback: "No expiry",
      }),
    ).toBe("No expiry");

    expect(formatCompactDuration(0.5)).toBe("<1 s");
    expect(formatCompactDuration(12)).toBe("12 s");
    expect(
      formatCompactDuration(12.34, {
        secondFractionDigits: 1,
      }),
    ).toBe("12.3 s");

    expect(formatCompactDuration(65)).toBe("1m 5s");
    expect(formatCompactDuration(3_661)).toBe("1h 1m");
    expect(formatCompactDuration(90_061)).toBe("1d 1h");
  });

  it("formats hours and minutes", () => {
    expect(formatHoursMinutesDuration(3_660)).toBe(
      "1h 1m",
    );
  });

  it("uses timestamp fallbacks", () => {
    expect(formatTimestamp(null)).toBe("Never");
    expect(formatTimestamp(null, "No expiry")).toBe(
      "No expiry",
    );
    expect(formatTimestamp("invalid-date")).toBe("Never");
  });
});