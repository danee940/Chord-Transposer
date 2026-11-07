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
  createWakeLockHold,
  fittingFontSize,
  longestLineLength,
  splitStanzas,
} from "./stage";
import { THEME_STORAGE_KEY } from "./theme";

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

describe("fittingFontSize", () => {
  it("keeps the default size when the longest line already fits", () => {
    expect(fittingFontSize(1200, 40)).toBe(24);
  });

  it("shrinks the text so the longest line fits a narrow screen", () => {
    expect(fittingFontSize(350, 34)).toBe(17);
  });

  it("never goes below the smallest readable size", () => {
    expect(fittingFontSize(200, 80)).toBe(16);
  });

  it("falls back to the default before layout or for an empty sheet", () => {
    expect(fittingFontSize(0, 34)).toBe(24);
    expect(fittingFontSize(350, 0)).toBe(24);
  });
});

describe("splitStanzas", () => {
  it("groups lines into stanzas separated by blank lines", () => {
    expect(splitStanzas("C G\nline one\n\n  \nF C\nline two\n")).toEqual([
      "C G\nline one",
      "F C\nline two",
    ]);
  });

  it("handles Windows line endings and leading blank lines", () => {
    expect(splitStanzas("\r\nC\r\nla\r\n\r\nG")).toEqual(["C\nla", "G"]);
  });

  it("returns no stanzas for blank text", () => {
    expect(splitStanzas(" \n\n")).toEqual([]);
  });
});

describe("longestLineLength", () => {
  it("measures the longest line in characters", () => {
    expect(longestLineLength("C G\nAmazing grace\nF")).toBe(13);
    expect(longestLineLength("")).toBe(0);
  });
});

interface FakeLock {
  release: ReturnType<typeof vi.fn>;
  addEventListener(type: string, listener: () => void): void;
  fireRelease(): void;
}

function fakeLock(): FakeLock {
  let onRelease = (): void => undefined;
  return {
    release: vi.fn(() => Promise.resolve()),
    addEventListener: (_type, listener) => {
      onRelease = listener;
    },
    fireRelease: () => onRelease(),
  };
}

function stubWakeLock(request: () => Promise<unknown>): ReturnType<typeof vi.fn> {
  const spy = vi.fn(request);
  Object.defineProperty(navigator, "wakeLock", { value: { request: spy }, configurable: true });
  return spy;
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createWakeLockHold", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("does nothing where the Screen Wake Lock API is missing", () => {
    const hold = createWakeLockHold();
    expect(() => {
      hold.acquire();
      hold.release();
    }).not.toThrow();
  });

  it("holds the screen awake until released", async () => {
    const lock = fakeLock();
    const request = stubWakeLock(() => Promise.resolve(lock));
    const hold = createWakeLockHold();
    hold.acquire();
    hold.acquire();
    await settle();
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith("screen");
    hold.acquire();
    expect(request).toHaveBeenCalledOnce();
    hold.release();
    expect(lock.release).toHaveBeenCalledOnce();
  });

  it("releases a lock granted after the hold was already released", async () => {
    const lock = fakeLock();
    stubWakeLock(() => Promise.resolve(lock));
    const hold = createWakeLockHold();
    hold.acquire();
    hold.release();
    await settle();
    expect(lock.release).toHaveBeenCalledOnce();
  });

  it("survives a refused request", async () => {
    stubWakeLock(() => Promise.reject(new Error("denied")));
    const hold = createWakeLockHold();
    hold.acquire();
    await settle();
    expect(() => hold.release()).not.toThrow();
  });

  it("asks again when the page becomes visible after the system released the lock", async () => {
    const first = fakeLock();
    const second = fakeLock();
    const request = stubWakeLock(() =>
      Promise.resolve(request.mock.calls.length > 1 ? second : first)
    );
    const hold = createWakeLockHold();
    hold.acquire();
    await settle();
    first.fireRelease();
    setVisibility("hidden");
    expect(request).toHaveBeenCalledOnce();
    setVisibility("visible");
    await settle();
    expect(request).toHaveBeenCalledTimes(2);

    first.fireRelease();
    hold.release();
    expect(second.release).toHaveBeenCalledOnce();
    setVisibility("visible");
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("createStageView", () => {
  let frames: FrameRequestCallback[];
  let prefersDark: boolean;

  beforeEach(() => {
    document.body.innerHTML = "";
    delete document.documentElement.dataset["theme"];
    localStorage.clear();
    prefersDark = false;
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", () => ({ matches: prefersDark }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function overlay() {
    return document.querySelector<HTMLElement>('[aria-label="Performance view"]')!;
  }

  function sheet() {
    return overlay().querySelector<HTMLElement>(".stage-sheet")!;
  }

  function scroller() {
    return overlay().querySelector<HTMLElement>(".stage-scroller")!;
  }

  function button(name: string) {
    return [...overlay().querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === name || b.textContent === name
    )!;
  }

  function playButton() {
    return [...document.querySelectorAll("button")].find((b) =>
      ["Play", "Pause"].includes(b.textContent)
    )!;
  }

  function press(key: string, init: KeyboardEventInit = {}, target?: Element) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    (target ?? overlay()).dispatchEvent(event);
    return event;
  }

  it("opens with the heading and the sheet split into stanzas with highlighted chords", () => {
    const view = createStageView();
    view.open("C   G\nTwinkle twinkle\n\n[Am]How I wonder", "C → D");
    expect(overlay().querySelector("h2")!.textContent).toBe("C → D");
    const stanzas = [...sheet().querySelectorAll(".stage-stanza")];
    expect(stanzas.map((stanza) => stanza.textContent)).toEqual([
      "C   G\nTwinkle twinkle",
      "[Am]How I wonder",
    ]);
    const chords = [...sheet().querySelectorAll(".stage-chord")].map((chord) => chord.textContent);
    expect(chords).toEqual(["C", "G", "Am"]);
    expect(sheet().querySelector("button")).toBeNull();
    expect(sheet().style.getPropertyValue("--stage-line-length")).toBe("16");
    expect(sheet().style.fontSize).toBe("24px");
    expect(document.body.classList.contains("overflow-hidden")).toBe(true);
  });

  it("fits the text to a narrow screen until the reader picks a size", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      paddingLeft: "20px",
      paddingRight: "20px",
    } as CSSStyleDeclaration);
    const view = createStageView();
    view.open("Amazing grace, how sweet the sound", "G → D");
    expect(sheet().style.fontSize).toBe("17px");

    button("Increase font size").click();
    view.open("Amazing grace, how sweet the sound", "G → D");
    expect(sheet().style.fontSize).toBe("19px");
  });

  it("toggles play state and runs the autoscroll loop", () => {
    const view = createStageView();
    view.open("line\n".repeat(50), "");
    playButton().click();
    expect(playButton().textContent).toBe("Pause");
    expect(playButton().getAttribute("aria-pressed")).toBe("true");
    Object.defineProperty(scroller(), "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scroller(), "clientHeight", { value: 100, configurable: true });
    frames.shift()!(0);
    frames.shift()!(1000);
    expect(scroller().scrollTop).toBeGreaterThan(0);
    playButton().click();
    expect(playButton().textContent).toBe("Play");
  });

  it("ignores a stale animation frame after pausing", () => {
    const view = createStageView();
    view.open("song", "");
    playButton().click();
    const pending = frames.shift()!;
    playButton().click();
    pending(0);
    expect(scroller().scrollTop).toBe(0);
    expect(frames).toHaveLength(0);
  });

  it("stops when the autoscroll reaches the end", () => {
    const view = createStageView();
    view.open("song", "");
    Object.defineProperty(scroller(), "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(scroller(), "clientHeight", { value: 100, configurable: true });
    playButton().click();
    frames.shift()!(0);
    frames.shift()!(16);
    expect(playButton().textContent).toBe("Play");
  });

  it("adjusts the autoscroll speed", () => {
    const view = createStageView();
    view.open("song", "");
    const speed = overlay().querySelector<HTMLInputElement>('input[type="range"]')!;
    speed.value = "120";
    speed.dispatchEvent(new Event("input"));
    expect(speed.value).toBe("120");
  });

  it("changes the font size within bounds from the buttons and the keyboard", () => {
    const view = createStageView();
    view.open("song", "");
    button("Increase font size").click();
    expect(sheet().style.fontSize).toBe("26px");
    button("Decrease font size").click();
    expect(sheet().style.fontSize).toBe("24px");
    expect(press("+").defaultPrevented).toBe(true);
    press("=");
    expect(sheet().style.fontSize).toBe("28px");
    press("-");
    press("_");
    expect(sheet().style.fontSize).toBe("24px");
  });

  it("leaves + and − to the speed slider while it has focus", () => {
    const view = createStageView();
    view.open("song", "");
    const speed = overlay().querySelector<HTMLInputElement>('input[type="range"]')!;
    press("+", {}, speed);
    press("-", {}, speed);
    expect(sheet().style.fontSize).toBe("24px");
  });

  it("lays the stanzas out in two columns on request", () => {
    const view = createStageView();
    view.open("song", "");
    const columns = button("2 columns");
    columns.click();
    expect(sheet().hasAttribute("data-columns")).toBe(true);
    expect(columns.getAttribute("aria-pressed")).toBe("true");
    columns.click();
    expect(sheet().hasAttribute("data-columns")).toBe(false);
    expect(columns.getAttribute("aria-pressed")).toBe("false");
  });

  it("flips between the light and dark theme and saves the choice", () => {
    const view = createStageView();
    view.open("song", "");
    button("Switch to dark theme").click();
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    button("Switch to light theme").click();
    expect(document.documentElement.dataset["theme"]).toBe("light");
  });

  it("offers the light theme when the system is already dark", () => {
    prefersDark = true;
    const view = createStageView();
    view.open("song", "");
    expect(button("Switch to light theme")).toBeDefined();
  });

  it("keeps the screen awake while open", async () => {
    const lock = fakeLock();
    const request = stubWakeLock(() => Promise.resolve(lock));
    const view = createStageView();
    view.open("song", "");
    await settle();
    expect(request).toHaveBeenCalledOnce();
    button("Close").click();
    expect(lock.release).toHaveBeenCalledOnce();
    Reflect.deleteProperty(navigator, "wakeLock");
  });

  it("closes with the close button and restores focus", () => {
    const opener = document.createElement("button");
    opener.focus = vi.fn();
    document.body.appendChild(opener);
    Object.defineProperty(document, "activeElement", { value: opener, configurable: true });
    const view = createStageView();
    view.open("song", "");
    button("Close").dispatchEvent(new Event("click"));
    expect(overlay().classList.contains("hidden")).toBe(true);
    expect(document.body.classList.contains("overflow-hidden")).toBe(false);
    expect(opener.focus).toHaveBeenCalled();
    Reflect.deleteProperty(document, "activeElement");
  });

  it("closes on Escape and toggles play on Space at the overlay", () => {
    const view = createStageView();
    view.open("song", "");
    press("Escape");
    expect(overlay().classList.contains("hidden")).toBe(true);

    view.open("song", "");
    press(" ");
    expect(playButton().textContent).toBe("Pause");
  });

  it("plays on Space from the sheet but leaves Space to a focused button", () => {
    const view = createStageView();
    view.open("song", "");
    press("x");
    expect(playButton().textContent).toBe("Play");
    expect(press(" ", {}, sheet()).defaultPrevented).toBe(true);
    expect(playButton().textContent).toBe("Pause");
    expect(press(" ", {}, button("Increase font size")).defaultPrevented).toBe(false);
    expect(press(" ", {}, overlay().querySelector("input")!).defaultPrevented).toBe(false);
    expect(playButton().textContent).toBe("Pause");
  });

  it("leaves browser shortcuts such as Ctrl and Cmd zoom alone", () => {
    const view = createStageView();
    view.open("song", "");
    for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
      expect(press("=", { [modifier]: true }).defaultPrevented).toBe(false);
      expect(press("-", { [modifier]: true }).defaultPrevented).toBe(false);
      expect(press(" ", { [modifier]: true }).defaultPrevented).toBe(false);
    }
    expect(sheet().style.fontSize).toBe("24px");
    expect(playButton().textContent).toBe("Play");
  });

  it("keeps Tab focus inside the dialog", () => {
    const view = createStageView();
    view.open("song", "");
    const visible = [...overlay().querySelectorAll<HTMLElement>("button, input")];
    const columns = button("2 columns");
    columns.checkVisibility = () => false;
    const close = button("Close");
    const play = playButton();

    close.focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(play);

    expect(press("Tab", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    overlay().focus();
    press("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(close);

    const middle = visible.find((element) => element !== play && element !== close)!;
    middle.focus();
    expect(press("Tab").defaultPrevented).toBe(false);
    expect(press("Tab", { shiftKey: true }).defaultPrevented).toBe(false);
  });

  it("wraps Tab past controls that are hidden on this screen", () => {
    const view = createStageView();
    view.open("song", "");
    const close = button("Close");
    close.checkVisibility = () => false;
    const theme = button("Switch to dark theme");
    theme.focus();
    expect(press("Tab").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(playButton());
    press("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(theme);
  });

  it("lets Tab through when no control is visible", () => {
    const view = createStageView();
    view.open("song", "");
    for (const control of overlay().querySelectorAll<HTMLElement>("button, input")) {
      control.checkVisibility = () => false;
    }
    expect(press("Tab").defaultPrevented).toBe(false);
  });

  it("reuses the overlay across opens without rebuilding", () => {
    const view = createStageView();
    view.open("first", "One");
    view.open("second", "Two");
    expect(document.querySelectorAll('[aria-label="Performance view"]')).toHaveLength(1);
    expect(sheet().textContent).toBe("second");
    expect(overlay().querySelector("h2")!.textContent).toBe("Two");
  });

  it("handles closing when there is no prior focus target", () => {
    Object.defineProperty(document, "activeElement", { value: null, configurable: true });
    const view = createStageView();
    view.open("song", "");
    expect(() => button("Close").dispatchEvent(new Event("click"))).not.toThrow();
    Reflect.deleteProperty(document, "activeElement");
  });
});
