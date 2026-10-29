import { beforeEach, describe, expect, it, vi } from "vitest";

import { initDiagrams } from "./index";

describe("initDiagrams", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders interactive chord tokens into a container", () => {
    const diagrams = initDiagrams(() => "guitar");
    const container = document.createElement("div");
    diagrams.renderInto(container, "C  G  Am");
    expect(container.querySelectorAll("button.chord-token").length).toBe(3);
  });

  it("shows a popover when a chord token is activated", () => {
    const diagrams = initDiagrams(() => "guitar");
    const container = document.createElement("div");
    document.body.appendChild(container);
    diagrams.renderInto(container, "C  G");
    const button = container.querySelector("button.chord-token");
    button.getBoundingClientRect = () => ({ left: 0, right: 20, top: 0, bottom: 20, width: 20, height: 20 });
    button.focus = vi.fn();
    button.dispatchEvent(new Event("click"));
    expect(document.querySelector(".chord-popover")).not.toBeNull();
  });

  it("closes the popover on demand", () => {
    const diagrams = initDiagrams(() => "guitar");
    expect(() => diagrams.closePopover()).not.toThrow();
  });

  it("respects the German instrument accessor", () => {
    const diagrams = initDiagrams(() => "piano");
    const container = document.createElement("div");
    document.body.appendChild(container);
    diagrams.renderInto(container, "H  Cis");
    const button = container.querySelector("button.chord-token");
    expect(button.dataset.german).toBe("1");
  });
});
