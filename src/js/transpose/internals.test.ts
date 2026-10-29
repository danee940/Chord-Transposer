import { describe, expect, it } from "vitest";

import { ChangeSet, isChordToken, transposeChord } from "./chords";
import { chordToNashville, nashvilleLine, noteToNashvilleDegree } from "./nashville";
import { capitalizeFirst, isMinorSuffix, keySemitone, mod12, noteSemitone, parseKey } from "./notation";

describe("ChangeSet.sorted", () => {
  it("orders by original then by transposed and dedupes identical pairs", () => {
    const set = new ChangeSet();
    set.add("A", "C");
    set.add("A", "B");
    set.add("A", "C");
    set.add("B", "D");
    expect(set.sorted()).toEqual([
      ["A", "B"],
      ["A", "C"],
      ["B", "D"],
    ]);
  });

  it("orders descending transposed values within the same original", () => {
    const set = new ChangeSet();
    set.add("A", "Z");
    set.add("A", "B");
    expect(set.sorted()).toEqual([
      ["A", "B"],
      ["A", "Z"],
    ]);
  });
});

describe("transposeChord affixes", () => {
  it("preserves surrounding punctuation while transposing the core", () => {
    expect(transposeChord("(C)", 2, ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], false)).toBe(
      "(D)"
    );
  });

  it("returns the token unchanged when the core is not a chord", () => {
    const spelling = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    expect(transposeChord("(xyz)", 2, spelling, false)).toBe("(xyz)");
  });
});

describe("nashville affixes and degrees", () => {
  it("wraps degrees while keeping punctuation", () => {
    expect(chordToNashville("(C)", 0, false)).toBe("(1)");
  });

  it("keeps non-chord punctuation tokens intact", () => {
    expect(chordToNashville("(xyz)", 0, false)).toBe("(xyz)");
  });

  it("maps chromatic degrees", () => {
    expect(noteToNashvilleDegree("Db", 0, false)).toBe("b2");
  });

  it("converts a full chord line", () => {
    expect(nashvilleLine("C  G  Am", 0, false)).toBe("1  5  6m");
  });

  it("leaves plain lyric tokens untouched", () => {
    expect(nashvilleLine("hello world", 0, false)).toBe("hello world");
  });
});

describe("notation helpers", () => {
  it("normalises negative values with mod12", () => {
    expect(mod12(-1)).toBe(11);
  });

  it("capitalises the first character and handles the empty string", () => {
    expect(capitalizeFirst("des")).toBe("Des");
    expect(capitalizeFirst("")).toBe("");
  });

  it("recognises minor suffixes", () => {
    expect(isMinorSuffix("m")).toBe(true);
    expect(isMinorSuffix("maj")).toBe(false);
  });

  it("resolves German-only roots via keySemitone", () => {
    expect(keySemitone("Cis", true)).toBe(1);
  });

  it("looks up plain note semitones", () => {
    expect(noteSemitone("C", false)).toBe(0);
  });

  it("returns null for blank keys", () => {
    expect(parseKey("   ")).toBeNull();
  });

  it("parses a German minor key", () => {
    expect(parseKey("Cism")).toEqual({ note: "Cis", minor: true });
  });

  it("parses a German major key", () => {
    expect(parseKey("Ges")).toEqual({ note: "Ges", minor: false });
  });

  it("returns null for an unknown key", () => {
    expect(parseKey("Zb")).toBeNull();
  });

  it("classifies tokens", () => {
    expect(isChordToken("Cmaj7")).toBe(true);
    expect(isChordToken("chorus")).toBe(false);
  });
});
