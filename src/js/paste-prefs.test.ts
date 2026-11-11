import { beforeEach, describe, expect, it } from "vitest";

import { keyNamesPref, persistPaste, savedKeyNames, type PasteSnapshot } from "./paste-prefs";
import { loadPrefs } from "./prefs";

function snapshot(overrides: Partial<PasteSnapshot> = {}): PasteSnapshot {
  return {
    mode: "key",
    currentKey: "C",
    targetKey: "D",
    semitones: 0,
    useFlats: false,
    keyNames: undefined,
    instrument: "guitar",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("savedKeyNames", () => {
  it("maps the stored notation back to a flag", () => {
    expect(savedKeyNames("german")).toBe(true);
    expect(savedKeyNames("english")).toBe(false);
  });

  it("leaves auto-detection in place for anything else", () => {
    expect(savedKeyNames(undefined)).toBeUndefined();
    expect(savedKeyNames("klingon")).toBeUndefined();
  });
});

describe("keyNamesPref", () => {
  it("stores an explicit notation choice", () => {
    expect(keyNamesPref(true)).toBe("german");
    expect(keyNamesPref(false)).toBe("english");
  });

  it("stores nothing when the reader has not chosen", () => {
    expect(keyNamesPref(undefined)).toBeUndefined();
  });
});

describe("persistPaste", () => {
  it("round-trips the panel state through storage", () => {
    persistPaste(
      snapshot({
        mode: "semitone",
        semitones: -3,
        useFlats: true,
        keyNames: true,
        instrument: "ukulele",
      })
    );

    expect(loadPrefs()).toEqual({
      mode: "semitone",
      currentKey: "C",
      targetKey: "D",
      semitones: -3,
      notation: "flat",
      keyNames: "german",
      instrument: "ukulele",
    });
  });

  it("records sharp notation and omits an unset key-name choice", () => {
    persistPaste(snapshot());
    const stored = loadPrefs();
    expect(stored.notation).toBe("sharp");
    expect(stored.keyNames).toBeUndefined();
  });
});
