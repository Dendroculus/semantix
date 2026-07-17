import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ResponseCard } from "../src/components/ResponseCard";

describe("ResponseCard math rendering", () => {
  afterEach(cleanup);

  it("renders dollar and LaTeX math delimiters with KaTeX", () => {
    const { container } = render(
      <ResponseCard
        result={{
          response: [
            "Inline dollar math: $x^2 + y^2 = z^2$.",
            "Inline LaTeX math: \\(E = mc^2\\).",
            "",
            "\\[",
            "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
            "\\]",
          ].join("\n"),
          cache_hit: false,
          similarity_score: null,
          latency_ms: 12,
        }}
      />,
    );

    expect(container.querySelectorAll(".katex")).toHaveLength(3);
    expect(
      container.querySelectorAll(".katex-display"),
    ).toHaveLength(1);
  });

  it("does not transform math delimiters inside code", () => {
    const { container } = render(
      <ResponseCard
        result={{
          response:
            "Use `\\(not rendered as math\\)` in this example.",
          cache_hit: false,
          similarity_score: null,
          latency_ms: 12,
        }}
      />,
    );

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.querySelector("code")?.textContent).toBe(
      "\\(not rendered as math\\)",
    );
  });
});