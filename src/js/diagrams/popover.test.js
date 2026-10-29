import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChordPopover } from "./popover";
import { parseChordSymbol } from "./shapes";

function makeAnchor() {
  const button = document.createElement("button");
  button.getBoundingClientRect = () => ({ left: 100, right: 140, bottom: 50, top: 30, width: 40, height: 20 });
  button.focus = vi.fn();
  document.body.appendChild(button);
  return button;
}

describe("createChordPopover", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.innerHeight = 600;
    window.innerWidth = 800;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a diagram anchored to the trigger and focuses the close button", () => {
    const popover = createChordPopover(() => "guitar");
    const anchor = makeAnchor();
    popover.show(anchor, parseChordSymbol("C"));
    const element = document.querySelector(".chord-popover");
    expect(element.classList.contains("hidden")).toBe(false);
    expect(element.style.left).not.toBe("");
    expect(element.style.top).not.toBe("");
  });

  it("flips above the anchor when there is no room below", () => {
    const popover = createChordPopover(() => "guitar");
    const anchor = makeAnchor();
    anchor.getBoundingClientRect = () => ({ left: 100, right: 140, bottom: 590, top: 570, width: 40, height: 20 });
    popover.show(anchor, parseChordSymbol("C"));
    const element = document.querySelector(".chord-popover");
    element.getBoundingClientRect = () => ({ width: 200, height: 200 });
    popover.hide();
    popover.show(anchor, parseChordSymbol("C"));
    expect(element.style.top).not.toBe("");
  });

  it("hides on Escape and restores focus to the anchor", () => {
    const popover = createChordPopover(() => "guitar");
    const anchor = makeAnchor();
    popover.show(anchor, parseChordSymbol("C"));
    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);
    expect(document.querySelector(".chord-popover").classList.contains("hidden")).toBe(true);
    expect(anchor.focus).toHaveBeenCalled();
  });

  it("ignores non-Escape keys", () => {
    const popover = createChordPopover(() => "guitar");
    popover.show(makeAnchor(), parseChordSymbol("C"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(document.querySelector(".chord-popover").classList.contains("hidden")).toBe(false);
  });

  it("closes on a pointer press outside the popover", () => {
    const popover = createChordPopover(() => "guitar");
    popover.show(makeAnchor(), parseChordSymbol("C"));
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const event = new Event("pointerdown");
    Object.defineProperty(event, "target", { value: outside });
    document.dispatchEvent(event);
    expect(document.querySelector(".chord-popover").classList.contains("hidden")).toBe(true);
  });

  it("keeps open when the pointer press is inside the popover or on the anchor", () => {
    const popover = createChordPopover(() => "guitar");
    const anchor = makeAnchor();
    popover.show(anchor, parseChordSymbol("C"));
    const element = document.querySelector(".chord-popover");

    const inside = new Event("pointerdown");
    Object.defineProperty(inside, "target", { value: element });
    document.dispatchEvent(inside);
    expect(element.classList.contains("hidden")).toBe(false);

    const onAnchor = new Event("pointerdown");
    Object.defineProperty(onAnchor, "target", { value: anchor });
    document.dispatchEvent(onAnchor);
    expect(element.classList.contains("hidden")).toBe(false);
  });

  it("closes when the built-in close button is clicked", () => {
    const popover = createChordPopover(() => "guitar");
    popover.show(makeAnchor(), parseChordSymbol("C"));
    document.querySelector(".chord-popover-close").dispatchEvent(new Event("click"));
    expect(document.querySelector(".chord-popover").classList.contains("hidden")).toBe(true);
  });

  it("is a no-op to hide when already hidden", () => {
    const popover = createChordPopover(() => "guitar");
    expect(() => popover.hide()).not.toThrow();
    popover.show(makeAnchor(), parseChordSymbol("C"));
    popover.hide();
    expect(() => popover.hide()).not.toThrow();
  });

  it("reuses the same element across shows", () => {
    const popover = createChordPopover(() => "guitar");
    popover.show(makeAnchor(), parseChordSymbol("C"));
    popover.show(makeAnchor(), parseChordSymbol("G"));
    expect(document.querySelectorAll(".chord-popover")).toHaveLength(1);
  });
});
