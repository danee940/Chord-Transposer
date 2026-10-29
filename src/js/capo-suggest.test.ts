import { describe, expect, it } from "vitest";

import { capoOptions, formatCapoSuggestion, keyToCapoSemitone, suggestCapo } from "./capo-suggest";

describe("keyToCapoSemitone", () => {
  it("resolves flat and sharp spellings", () => {
    expect(keyToCapoSemitone("C")).toBe(0);
    expect(keyToCapoSemitone("Db")).toBe(1);
    expect(keyToCapoSemitone("C#")).toBe(1);
    expect(keyToCapoSemitone("Am")).toBe(9);
  });

  it("returns null for unknown input", () => {
    expect(keyToCapoSemitone("H")).toBe(null);
  });
});

describe("capoOptions", () => {
  it("sorts friendly shapes by lowest fret and stays within the max fret", () => {
    const rows = capoOptions("D");
    expect(rows[0]).toEqual({ fret: 0, shape: "D" });
    expect(rows.every((row) => row.fret <= 7)).toBe(true);
  });

  it("uses minor shapes for minor keys", () => {
    const rows = capoOptions("Am");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.shape.endsWith("m"))).toBe(true);
    expect(rows[0]?.fret).toBe(0);
  });

  it("returns nothing for an unknown key", () => {
    expect(capoOptions("H")).toEqual([]);
  });
});

describe("suggestCapo", () => {
  it("returns the lowest-fret option with the sounding key", () => {
    expect(suggestCapo("E")).toEqual({ fret: 0, shape: "E", sounds: "E" });
    expect(suggestCapo("Bb")).toEqual({ fret: 1, shape: "A", sounds: "Bb" });
  });

  it("returns null for an unknown key", () => {
    expect(suggestCapo("H")).toBe(null);
  });
});

describe("formatCapoSuggestion", () => {
  it("describes a no-capo open-shape key", () => {
    expect(formatCapoSuggestion("G")).toBe("To sound in G, play G shapes with no capo.");
  });

  it("describes a capo position", () => {
    expect(formatCapoSuggestion("Bb")).toBe("To sound in Bb, capo 1 and play A shapes.");
  });

  it("returns null for an unknown key", () => {
    expect(formatCapoSuggestion("H")).toBe(null);
  });
});
