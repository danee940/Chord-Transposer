import { afterEach, describe, expect, it } from "vitest";

import { makeCell, makeHeaderCell, requireElement, requireSelector } from "./dom";

describe("dom helpers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

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

  it("returns required elements by id and selector", () => {
    document.body.innerHTML = `<select id="key"></select><label for="key"></label>`;
    expect(requireElement<HTMLSelectElement>("key").tagName).toBe("SELECT");
    expect(requireSelector<HTMLLabelElement>('label[for="key"]').htmlFor).toBe("key");
  });

  it("throws a descriptive error when a required element is missing", () => {
    expect(() => requireElement("missing")).toThrow("Missing required element: #missing");
    expect(() => requireSelector(".missing")).toThrow("Missing required element: .missing");
  });
});
