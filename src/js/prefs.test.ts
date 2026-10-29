import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPrefs, sanitizePrefs, savePrefs, type Prefs } from "./prefs";

describe("sanitizePrefs", () => {
  it("keeps only the allowed preference keys", () => {
    const clean = sanitizePrefs({
      mode: "key",
      currentKey: "C",
      targetKey: "D",
      semitones: 2,
      notation: "flat",
      instrument: "guitar",
      chordText: "C G Am F",
      lyrics: "secret verse",
    });
    expect(clean).toEqual({
      mode: "key",
      currentKey: "C",
      targetKey: "D",
      semitones: 2,
      notation: "flat",
      instrument: "guitar",
    });
    expect(clean).not.toHaveProperty("chordText");
    expect(clean).not.toHaveProperty("lyrics");
  });

  it("drops values of the wrong type", () => {
    expect(sanitizePrefs({ currentKey: { nested: true }, targetKey: ["D"] })).toEqual({});
    expect(sanitizePrefs({ currentKey: 5, semitones: "3", notation: true })).toEqual({});
  });

  it("returns an empty object for non-object input", () => {
    expect(sanitizePrefs(null)).toEqual({});
    expect(sanitizePrefs("string")).toEqual({});
  });
});

describe("loadPrefs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty object when nothing is stored", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(loadPrefs()).toEqual({});
  });

  it("parses and sanitizes stored preferences", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ mode: "key", chordText: "secret" }),
    });
    expect(loadPrefs()).toEqual({ mode: "key" });
  });

  it("returns an empty object when parsing throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "{not json",
    });
    expect(loadPrefs()).toEqual({});
  });
});

describe("savePrefs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes sanitized preferences to storage", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    savePrefs({ mode: "key", junk: () => {} } as Prefs);
    expect(setItem).toHaveBeenCalledWith("chord-transposer:prefs", JSON.stringify({ mode: "key" }));
  });

  it("swallows storage errors", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => savePrefs({ mode: "key" })).not.toThrow();
  });
});
