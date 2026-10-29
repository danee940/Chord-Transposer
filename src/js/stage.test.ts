import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  autoscrollAtEnd,
  autoscrollStep,
  AUTOSCROLL_DEFAULT_SPEED,
  AUTOSCROLL_MAX_SPEED,
  AUTOSCROLL_MIN_SPEED,
  clampAutoscrollSpeed,
  clampFontSize,
  createStageView,
} from "./stage";

describe("autoscrollStep", () => {
  it("advances by speed scaled to elapsed time", () => {
    expect(autoscrollStep(0, 60, 1000, 1000)).toBe(60);
    expect(autoscrollStep(100, 60, 500, 1000)).toBe(130);
  });

  it("never scrolls past the maximum", () => {
    expect(autoscrollStep(990, 60, 1000, 1000)).toBe(1000);
  });

  it("never scrolls below zero", () => {
    expect(autoscrollStep(10, -60, 1000, 1000)).toBe(0);
  });

  it("treats a negative max as zero", () => {
    expect(autoscrollStep(0, 60, 1000, -50)).toBe(0);
  });
});

describe("autoscrollAtEnd", () => {
  it("is true within a pixel of the bottom", () => {
    expect(autoscrollAtEnd(1000, 1000)).toBe(true);
    expect(autoscrollAtEnd(999.5, 1000)).toBe(true);
  });

  it("is false while scrolling remains", () => {
    expect(autoscrollAtEnd(500, 1000)).toBe(false);
  });
});

describe("clampAutoscrollSpeed", () => {
  it("clamps to the configured range", () => {
    expect(clampAutoscrollSpeed(0)).toBe(AUTOSCROLL_MIN_SPEED);
    expect(clampAutoscrollSpeed(9999)).toBe(AUTOSCROLL_MAX_SPEED);
    expect(clampAutoscrollSpeed(60)).toBe(60);
  });

  it("falls back to the default for NaN", () => {
    expect(clampAutoscrollSpeed(Number.NaN)).toBe(AUTOSCROLL_DEFAULT_SPEED);
  });
});

describe("clampFontSize", () => {
  it("clamps to the readable range", () => {
    expect(clampFontSize(4)).toBe(16);
    expect(clampFontSize(999)).toBe(48);
    expect(clampFontSize(24)).toBe(24);
  });
});

describe("createStageView", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    document.body.innerHTML = "";
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function overlay() {
    return document.querySelector<HTMLElement>('[aria-label="Performance view"]')!;
  }

  function playButton() {
    return [...document.querySelectorAll("button")].find((b) => ["Play", "Pause"].includes(b.textContent))!;
  }

  it("builds and opens the overlay with the given text", () => {
    const view = createStageView();
    view.open("C G Am F");
    expect(overlay()).not.toBeNull();
    expect(overlay().querySelector("pre")!.textContent).toBe("C G Am F");
    expect(document.body.classList.contains("overflow-hidden")).toBe(true);
  });

  it("toggles play state and runs the autoscroll loop", () => {
    const view = createStageView();
    view.open("line\n".repeat(50));
    const scroller = overlay().querySelector<HTMLElement>(".overflow-auto")!;
    Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 100, configurable: true });
    playButton().dispatchEvent(new Event("click"));
    expect(playButton().textContent).toBe("Pause");
    frames.pop()!(1000);
    frames.pop()!(2000);
    expect(scroller.scrollTop).toBeGreaterThan(0);
  });

  it("ignores a stale animation frame after pausing", () => {
    const view = createStageView();
    view.open("line\n".repeat(50));
    const scroller = overlay().querySelector<HTMLElement>(".overflow-auto")!;
    Object.defineProperty(scroller, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 100, configurable: true });
    playButton().dispatchEvent(new Event("click"));
    const staleFrame = frames.pop()!;
    playButton().dispatchEvent(new Event("click"));
    expect(() => staleFrame(500)).not.toThrow();
    expect(scroller.scrollTop).toBe(0);
  });

  it("stops when the autoscroll reaches the end", () => {
    const view = createStageView();
    view.open("song");
    const scroller = overlay().querySelector<HTMLElement>(".overflow-auto")!;
    Object.defineProperty(scroller, "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(scroller, "clientHeight", { value: 100, configurable: true });
    playButton().dispatchEvent(new Event("click"));
    frames.pop()!(1000);
    frames.pop()!(5000);
    expect(playButton().textContent).toBe("Play");
  });

  it("adjusts the autoscroll speed", () => {
    const view = createStageView();
    view.open("song");
    const speed = overlay().querySelector<HTMLInputElement>('input[type="range"]')!;
    speed.value = "120";
    speed.dispatchEvent(new Event("input"));
    expect(speed.value).toBe("120");
  });

  it("changes the font size within bounds", () => {
    const view = createStageView();
    view.open("song");
    const content = overlay().querySelector("pre")!;
    const [down, up] = [...overlay().querySelectorAll("button")].filter((b) =>
      ["A−", "A+"].includes(b.textContent)
    ) as [HTMLButtonElement, HTMLButtonElement];
    up.dispatchEvent(new Event("click"));
    expect(content.style.fontSize).toBe("26px");
    down.dispatchEvent(new Event("click"));
    expect(content.style.fontSize).toBe("24px");
  });

  it("closes with the close button and restores focus", () => {
    const opener = document.createElement("button");
    opener.focus = vi.fn();
    document.body.appendChild(opener);
    opener.focus();
    Object.defineProperty(document, "activeElement", { value: opener, configurable: true });
    const view = createStageView();
    view.open("song");
    const close = [...overlay().querySelectorAll("button")].find((b) => b.textContent === "Close")!;
    close.dispatchEvent(new Event("click"));
    expect(overlay().classList.contains("hidden")).toBe(true);
    expect(opener.focus).toHaveBeenCalled();
  });

  it("closes on Escape and toggles play on Space at the overlay", () => {
    const view = createStageView();
    view.open("song");
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    overlay().dispatchEvent(escape);
    expect(overlay().classList.contains("hidden")).toBe(true);

    view.open("song");
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    Object.defineProperty(space, "target", { value: overlay() });
    overlay().dispatchEvent(space);
    expect(playButton().textContent).toBe("Pause");
  });

  it("ignores other keys and space away from the overlay", () => {
    const view = createStageView();
    view.open("song");
    overlay().dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    const space = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    Object.defineProperty(space, "target", { value: overlay().querySelector("pre") });
    overlay().dispatchEvent(space);
    expect(playButton().textContent).toBe("Play");
  });

  it("reuses the overlay across opens without rebuilding", () => {
    const view = createStageView();
    view.open("first");
    view.open("second");
    expect(document.querySelectorAll('[aria-label="Performance view"]')).toHaveLength(1);
    expect(overlay().querySelector("pre")!.textContent).toBe("second");
  });

  it("handles closing when there is no prior focus target", () => {
    Object.defineProperty(document, "activeElement", { value: null, configurable: true });
    const view = createStageView();
    view.open("song");
    const close = [...overlay().querySelectorAll("button")].find((b) => b.textContent === "Close")!;
    expect(() => close.dispatchEvent(new Event("click"))).not.toThrow();
  });
});
