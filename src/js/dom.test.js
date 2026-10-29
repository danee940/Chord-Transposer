import { describe, expect, it } from "vitest";

import { makeCell, makeHeaderCell } from "./dom";

describe("dom helpers", () => {
  it("builds a td with text and class", () => {
    const cell = makeCell("hello", "py-1 font-mono");
    expect(cell.tagName).toBe("TD");
    expect(cell.textContent).toBe("hello");
    expect(cell.className).toBe("py-1 font-mono");
  });

  it("builds a th with text and class", () => {
    const cell = makeHeaderCell("Before", "pb-1 font-medium");
    expect(cell.tagName).toBe("TH");
    expect(cell.textContent).toBe("Before");
    expect(cell.className).toBe("pb-1 font-medium");
  });
});
