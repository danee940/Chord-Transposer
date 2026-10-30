import { describe, expect, it } from "vitest";

import { ChangeSet, chordRoot, isChordToken, transposeChord } from "./chords";
import { chordToNashville, nashvilleLine, noteToNashvilleDegree } from "./nashville";
import {
  capitalizeFirst,
  FLAT_SPELLING,
  isMinorSuffix,
  keySemitone,
  keySpelling,
  mod12,
  noteSemitone,
  parseKey,
  SHARP_SPELLING,
  UnknownNoteError,
} from "./notation";

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

  it("orders ascending insertions within the same original", () => {
    const set = new ChangeSet();
    set.add("A", "B");
    set.add("A", "C");
    set.add("A", "D");
    expect(set.sorted()).toEqual([
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
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
    expect(transposeChord("(C)", 2, SHARP_SPELLING, false)).toBe("(D)");
  });

  it("returns the token unchanged when the core is not a chord", () => {
    const spelling = SHARP_SPELLING;
    expect(transposeChord("(xyz)", 2, spelling, false)).toBe("(xyz)");
  });
});

describe("unmatched roots", () => {
  it("returns a bare non-chord token unchanged from transposeChord", () => {
    expect(transposeChord("xyz", 2, SHARP_SPELLING, false)).toBe("xyz");
  });

  it("returns a bare non-chord token unchanged from chordToNashville", () => {
    expect(chordToNashville("xyz", 0, false)).toBe("xyz");
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

  it("rejects a note that is in no table", () => {
    expect(() => noteSemitone("Hb", false)).toThrow(UnknownNoteError);
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

describe("keySpelling", () => {
  it("spells Cb in Gb major", () => {
    const spelling = keySpelling("Gb", false, false);
    expect(spelling[11]).toBe("Cb");
    expect(spelling[5]).toBe("F");
    expect(spelling[1]).toBe("Db");
  });

  it("spells E# in F# major", () => {
    const spelling = keySpelling("F#", false, false);
    expect(spelling[5]).toBe("E#");
    expect(spelling[11]).toBe("B");
    expect(spelling[10]).toBe("A#");
  });

  it("spells Cb in Eb minor", () => {
    const spelling = keySpelling("Eb", true, false);
    expect(spelling[11]).toBe("Cb");
    expect(spelling[1]).toBe("Db");
  });

  it("keeps natural B in D# minor", () => {
    const spelling = keySpelling("D#", true, false);
    expect(spelling[11]).toBe("B");
    expect(spelling[5]).toBe("E#");
    // The leading tone would be C##; it falls back to the base spelling.
    expect(spelling[2]).toBe("D");
  });

  it("spells the raised leading tone in minor keys", () => {
    expect(keySpelling("D", true, false)[1]).toBe("C#");
    expect(keySpelling("G", true, false)[6]).toBe("F#");
    expect(keySpelling("F#", true, false)[5]).toBe("E#");
  });

  it("spells the German minor leading tone", () => {
    expect(keySpelling("D", true, true)[1]).toBe("Cis");
  });

  it("spells B# in A# minor", () => {
    expect(keySpelling("A#", true, false)[0]).toBe("B#");
  });

  it("spells His in German A# minor", () => {
    expect(keySpelling("Ais", true, true)[0]).toBe("His");
  });

  it("matches the fixed spellings for plain keys", () => {
    // C major defaults to the flat base; its own notes are all natural.
    expect(keySpelling("C", false, false)).toEqual([...FLAT_SPELLING]);
    expect(keySpelling("F", false, false)).toEqual([...FLAT_SPELLING]);
    expect(keySpelling("G", false, false)).toEqual([...SHARP_SPELLING]);
  });

  it("spells Ces and B in German Gb major", () => {
    const spelling = keySpelling("Gb", false, true);
    expect(spelling[11]).toBe("Ces");
    expect(spelling[10]).toBe("B");
    expect(spelling[6]).toBe("Ges");
  });

  it("spells Eis and H in German F# major", () => {
    const spelling = keySpelling("F#", false, true);
    expect(spelling[5]).toBe("Eis");
    expect(spelling[11]).toBe("H");
    expect(spelling[8]).toBe("Gis");
  });

  it("treats a German H key as B major", () => {
    const spelling = keySpelling("H", false, true);
    expect(spelling[11]).toBe("H");
    expect(spelling[1]).toBe("Cis");
  });

  it("spells As in a German Es key", () => {
    const spelling = keySpelling("Es", false, true);
    expect(spelling[8]).toBe("As");
    expect(spelling[3]).toBe("Es");
  });

  it("falls back to the base spelling for double accidentals", () => {
    // G# major would need F## on its seventh degree; keep the base spelling.
    expect(keySpelling("G#", false, false)[7]).toBe("G");
  });
});

describe("chordRoot", () => {
  it("returns the root of plain, slash, and decorated chords", () => {
    expect(chordRoot("Am7")).toBe("A");
    expect(chordRoot("C/E")).toBe("C");
    expect(chordRoot("(Bbmaj7)")).toBe("Bb");
  });

  it("returns German roots unchanged", () => {
    expect(chordRoot("Fis7")).toBe("Fis");
    expect(chordRoot("H")).toBe("H");
  });

  it("falls back to the full token when it is not a chord", () => {
    expect(chordRoot("??")).toBe("??");
  });
});
