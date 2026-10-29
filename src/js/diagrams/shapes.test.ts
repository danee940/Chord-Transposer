import { describe, expect, it } from "vitest";

import {
  chordNotes,
  classifyQuality,
  lookupShape,
  parseChordSymbol,
  type ChordFamily,
  type FrettedShape,
  type ParsedChord,
} from "./shapes";

function guitarFrets(symbol: string) {
  const shape = lookupShape(parseChordSymbol(symbol), "guitar");
  return shape?.kind === "fretted" ? shape.frets : null;
}

describe("classifyQuality", () => {
  const cases: [string, ChordFamily][] = [
    ["", "maj"],
    ["m", "min"],
    ["min", "min"],
    ["maj7", "maj7"],
    ["M7", "maj7"],
    ["m7", "min7"],
    ["7", "dom7"],
    ["dim", "dim"],
    ["°", "dim"],
    ["dim7", "dim7"],
    ["m7b5", "min7b5"],
    ["ø", "min7b5"],
    ["aug", "aug"],
    ["+", "aug"],
    ["sus2", "sus2"],
    ["sus4", "sus4"],
    ["sus", "sus4"],
    ["6", "maj6"],
    ["m6", "min6"],
    ["9", "dom9"],
    ["add9", "add9"],
  ];
  for (const [quality, expected] of cases) {
    it(`classifies ${JSON.stringify(quality)} as ${expected}`, () => {
      expect(classifyQuality(quality)).toBe(expected);
    });
  }
});

describe("guitar open-chord lookups", () => {
  const expected = {
    C: [-1, 3, 2, 0, 1, 0],
    D: [-1, -1, 0, 2, 3, 2],
    E: [0, 2, 2, 1, 0, 0],
    G: [3, 2, 0, 0, 0, 3],
    A: [-1, 0, 2, 2, 2, 0],
    Am: [-1, 0, 2, 2, 1, 0],
    Em: [0, 2, 2, 0, 0, 0],
    Dm: [-1, -1, 0, 2, 3, 1],
    E7: [0, 2, 0, 1, 0, 0],
    Am7: [-1, 0, 2, 0, 1, 0],
    Cmaj7: [-1, 3, 2, 0, 0, 0],
  };
  for (const [symbol, frets] of Object.entries(expected)) {
    it(`returns the expected shape for ${symbol}`, () => {
      expect(guitarFrets(symbol)).toEqual(frets);
    });
  }
});

describe("guitar movable barre fallbacks", () => {
  it("builds an E-shape barre for F#", () => {
    expect(guitarFrets("F#")).toEqual([2, 4, 4, 3, 2, 2]);
  });

  it("builds an A-shape barre for Bb", () => {
    expect(guitarFrets("Bb")).toEqual([-1, 1, 3, 3, 3, 1]);
  });

  it("builds a minor barre for Cm", () => {
    expect(guitarFrets("Cm")).toEqual([-1, 3, 5, 5, 4, 3]);
  });
});

describe("movable barre shapes for extended qualities", () => {
  const expected = {
    Cdim: [-1, 3, 4, 5, 4, -1],
    Cdim7: [-1, 3, 4, 5, 4, 5],
    Caug: [-1, 3, 6, 5, 5, 4],
    Csus2: [-1, 3, 5, 5, 3, 3],
    Csus4: [-1, 3, 5, 5, 6, 3],
    "G#m7b5": [-1, 11, 12, 11, 12, -1],
    C6: [-1, 3, 5, 5, 5, 5],
    Cm6: [-1, 3, 5, 5, 4, 5],
    C9: [-1, 3, -1, 3, 3, 3],
    Cm9: [-1, 3, -1, 3, 3, 4],
    Cadd9: [-1, 3, 5, 7, 3, 3],
  };
  for (const [symbol, frets] of Object.entries(expected)) {
    it(`returns a movable shape for ${symbol}`, () => {
      expect(guitarFrets(symbol)).toEqual(frets);
    });
  }

  it("still resolves the same chord on piano", () => {
    const shape = lookupShape(parseChordSymbol("Cdim"), "piano");
    expect(shape!.kind).toBe("piano");
  });
});

describe("ukulele lookups", () => {
  it("returns the open C shape", () => {
    const shape = lookupShape(parseChordSymbol("C"), "ukulele");
    expect((shape as FrettedShape).frets).toEqual([0, 0, 0, 3]);
  });
});

describe("piano and note spelling", () => {
  it("returns chord tones for a C major triad", () => {
    const shape = lookupShape(parseChordSymbol("C"), "piano");
    expect(shape!.kind).toBe("piano");
    expect(chordNotes(parseChordSymbol("C")!)).toEqual(["C", "E", "G"]);
  });

  it("includes the slash bass note", () => {
    expect(chordNotes(parseChordSymbol("C/G")!)).toContain("G");
  });

  it("spells a German H chord as B natural", () => {
    const chord = parseChordSymbol("H", true);
    expect(chord!.rootSemitone).toBe(11);
  });

  it("rejects non-chord tokens", () => {
    expect(parseChordSymbol("Chorus:")).toBeNull();
  });

  it("defaults unrecognised qualities to major", () => {
    expect(classifyQuality("(4)")).toBe("maj");
  });

  it("classifies minor ninth and minor sixth", () => {
    expect(classifyQuality("m9")).toBe("min9");
    expect(classifyQuality("m6")).toBe("min6");
  });

  it("classifies dominant ninth", () => {
    expect(classifyQuality("9")).toBe("dom9");
  });

  it("spells German chords using the German spelling table", () => {
    expect(chordNotes(parseChordSymbol("H", true)!)).toEqual(["H", "Dis", "Fis"]);
  });

  it("does not duplicate a bass note already present in the chord", () => {
    expect(chordNotes(parseChordSymbol("C/E")!)).toEqual(["C", "E", "G"]);
  });

  it("prepends a bass note that is outside the chord tones", () => {
    expect(chordNotes(parseChordSymbol("C/D")!)).toEqual(["D", "C", "E", "G"]);
  });

  it("builds a movable minor-seventh barre", () => {
    expect((lookupShape(parseChordSymbol("Bbm7"), "guitar") as FrettedShape).frets).toEqual([
      -1, 1, 3, 1, 2, 1,
    ]);
  });

  it("builds a movable major-seventh barre", () => {
    expect((lookupShape(parseChordSymbol("Bbmaj7"), "guitar") as FrettedShape).frets).toEqual([
      -1, 1, 3, 2, 3, 1,
    ]);
  });

  it("returns null for an empty core", () => {
    expect(parseChordSymbol("()")).toBeNull();
  });

  it("returns null when the root cannot be matched", () => {
    expect(parseChordSymbol("7")).toBeNull();
  });

  it("parses a slash bass note", () => {
    const chord = parseChordSymbol("C/G");
    expect(chord!.bassName).toBe("G");
    expect(chord!.bassSemitone).toBe(7);
  });

  it("uses the maj interval fallback for an unknown family in chordNotes", () => {
    expect(
      chordNotes({
        family: "unknown",
        rootSemitone: 0,
        bassSemitone: null,
        german: false,
      } as unknown as ParsedChord)
    ).toEqual(["C", "E", "G"]);
  });

  it("returns null when looking up a null chord", () => {
    expect(lookupShape(null, "guitar")).toBeNull();
  });

  it("returns null for an unsupported ukulele barre chord", () => {
    expect(lookupShape(parseChordSymbol("C#"), "ukulele")).toBeNull();
  });
});

describe("roots outside the note tables", () => {
  it("rejects a chord whose root has no semitone", () => {
    expect(parseChordSymbol("Hb")).toBeNull();
  });

  it("drops a slash bass whose root has no semitone", () => {
    const chord = parseChordSymbol("C/Hb")!;
    expect(chord.bassName).toBe("");
    expect(chord.bassSemitone).toBeNull();
  });
});
