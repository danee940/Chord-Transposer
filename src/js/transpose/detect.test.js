import { describe, expect, it } from "vitest";

import { detectKey } from "./detect.js";

describe("detectKey", () => {
  it("detects a basic major cadence", () => {
    expect(detectKey("C F G C")).toEqual({
      key: "C",
      alternate: null,
      ambiguous: false,
      chords: 4,
      distinct: 3,
    });
  });

  it("detects a minor key via the harmonic dominant", () => {
    expect(detectKey("Am Dm E7 Am").key).toBe("Am");
  });

  it("flags the relative pair as ambiguous with an alternate", () => {
    const result = detectKey("Am F C G\nAm F C G\nAm");
    expect(result.key).toBe("Am");
    expect(result.alternate).toBe("C");
    expect(result.ambiguous).toBe(true);
  });

  it("disambiguates the relative major via a dominant seventh", () => {
    const result = detectKey("G C D7 G\nEm C D7 G");
    expect(result.key).toBe("G");
    expect(result.ambiguous).toBe(false);
  });

  it("returns null for too few chords", () => {
    expect(detectKey("G")).toEqual({
      key: null,
      alternate: null,
      ambiguous: false,
      chords: 1,
      distinct: 1,
    });
  });

  it("returns null for a single repeated root", () => {
    expect(detectKey("C C C C").key).toBeNull();
  });

  it("returns null for lyrics-only text", () => {
    expect(detectKey("just some lyrics here").key).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(detectKey("").key).toBeNull();
  });

  it("detects from ChordPro brackets", () => {
    const result = detectKey("[C]Amazing [F]grace how [G7]sweet the [C]sound");
    expect(result.key).toBe("C");
    expect(result.chords).toBe(4);
  });

  it("skips non-chord ChordPro brackets", () => {
    expect(detectKey("[Verse]\n[C]la [F]la [G]la [C]la").chords).toBe(4);
  });

  it("spells German sheets with German labels", () => {
    expect(detectKey("H E Fis7 H\nE H Fis7 H").key).toBe("H");
  });

  it("reads lowercase roots as minor chords in mixed-case sheets", () => {
    expect(detectKey("e a H7 e").key).toBe("Em");
    expect(detectKey("a d E7 a").key).toBe("Am");
  });

  it("reads all-lowercase sheets as major", () => {
    expect(detectKey("c f g c\nf c g c").key).toBe("C");
  });

  it("spells flat keys conventionally", () => {
    expect(detectKey("Bb Eb F Bb").key).toBe("Bb");
  });

  it("spells sharp minor keys conventionally", () => {
    expect(detectKey("F#m D A E\nF#m D E F#m").key).toBe("F#m");
  });

  it("ignores slash bass notes", () => {
    expect(detectKey("C/E F G/B C").key).toBe("C");
  });

  it("ignores section labels and lyric lines", () => {
    expect(detectKey("VERSE:\nC F (G) C\nla la la lyrics").key).toBe("C");
  });

  it("flags modal sheets as ambiguous", () => {
    const result = detectKey("D C G D");
    expect(result.key).toBe("D");
    expect(result.alternate).toBe("G");
    expect(result.ambiguous).toBe(true);
  });

  it("classifies diminished symbols", () => {
    const result = detectKey("C°7 Fø7 G7 C");
    expect(result.key).toBe("C");
    expect(result.ambiguous).toBe(false);
  });

  it("breaks ranking ties deterministically", () => {
    const result = detectKey("C F# C F#\nC F# C");
    expect(result.key).toBe("C");
    expect(result.alternate).toBe("G");
    expect(result.ambiguous).toBe(true);
  });

  it("classifies chord qualities from suffixes", () => {
    expect(detectKey("Cmaj7 Fsus4 G13 C6\nDm7 G7 CM7 C").key).toBe("C");
    expect(detectKey("Am Bdim C-7 E79\nAm Ddim Am").key).toBe("Am");
  });
});
