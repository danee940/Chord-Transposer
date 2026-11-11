import { describe, expect, it } from "vitest";

import {
  computeResult,
  isChordProResult,
  isTransposeMode,
  resultChanges,
  semitoneLabel,
  stageTitle,
  summariseResult,
  type ResultOptions,
} from "./paste-result";

function options(overrides: Partial<ResultOptions> = {}): ResultOptions {
  return {
    mode: "key",
    currentKey: "C",
    targetKey: "D",
    semitones: 0,
    useFlats: false,
    outputFormat: "chordpro",
    notation: undefined,
    ...overrides,
  };
}

describe("isTransposeMode", () => {
  it("accepts the three modes and rejects anything else", () => {
    expect(isTransposeMode("key")).toBe(true);
    expect(isTransposeMode("semitone")).toBe(true);
    expect(isTransposeMode("nashville")).toBe(true);
    expect(isTransposeMode("capo")).toBe(false);
    expect(isTransposeMode(undefined)).toBe(false);
  });
});

describe("semitoneLabel", () => {
  it("signs the shift and names the accidental", () => {
    expect(semitoneLabel(2, false)).toBe("+2 semitones (♯)");
    expect(semitoneLabel(-3, true)).toBe("−3 semitones (♭)");
  });

  it("uses the singular for one semitone", () => {
    expect(semitoneLabel(1, false)).toBe("+1 semitone (♯)");
    expect(semitoneLabel(-1, false)).toBe("−1 semitone (♯)");
  });

  it("renders a zero shift with a minus sign", () => {
    expect(semitoneLabel(0, false)).toBe("−0 semitones (♯)");
  });
});

describe("computeResult in key mode", () => {
  it("transposes plain text between keys", () => {
    const result = computeResult("C G Am F", options());
    expect(result).toMatchObject({ kind: "key", text: "D A Bm G", from: "C", to: "D" });
    expect(isChordProResult(result)).toBe(false);
  });

  it("keeps ChordPro brackets by default", () => {
    const result = computeResult("[C]hello [G]world", options());
    expect(result.text).toBe("[D]hello [A]world");
    expect(isChordProResult(result)).toBe(true);
  });

  it("flattens ChordPro to plain chords when asked", () => {
    const result = computeResult("[C]hello [G]world", options({ outputFormat: "plain" }));
    expect(result.text).toBe("D A");
  });

  it("leaves plain text alone in plain output format", () => {
    const result = computeResult("C G Am F", options({ outputFormat: "plain" }));
    expect(result.text).toBe("D A Bm G");
  });
});

describe("computeResult in semitone mode", () => {
  it("shifts by semitones and labels the shift", () => {
    const result = computeResult("C G Am F", options({ mode: "semitone", semitones: 2 }));
    expect(result).toMatchObject({ kind: "semitone", text: "D A Bm G", label: "+2 semitones (♯)" });
  });

  it("uses flat spelling when asked, letting a widened chord hold its column", () => {
    const result = computeResult(
      "C G",
      options({ mode: "semitone", semitones: 1, useFlats: true })
    );
    expect(result.text).toBe("DbAb");
  });

  it("shifts ChordPro sheets too", () => {
    const result = computeResult("[C]hi", options({ mode: "semitone", semitones: 2 }));
    expect(result.text).toBe("[D]hi");
    expect(isChordProResult(result)).toBe(true);
  });
});

describe("computeResult in nashville mode", () => {
  it("numbers the chords against the tonic", () => {
    const result = computeResult("C G Am F", options({ mode: "nashville" }));
    expect(result).toMatchObject({ kind: "nashville", text: "1 5 6m 4", tonic: "C" });
  });

  it("reports no changes and no ChordPro flag", () => {
    const result = computeResult("C G Am F", options({ mode: "nashville" }));
    expect(resultChanges(result)).toEqual([]);
    expect(isChordProResult(result)).toBe(false);
  });
});

describe("summariseResult", () => {
  it("counts changed chords in key mode", () => {
    expect(summariseResult(computeResult("C G Am F", options()))).toBe("C → D · 4 chords changed");
  });

  it("uses the singular for one change", () => {
    expect(summariseResult(computeResult("C", options()))).toBe("C → D · 1 chord changed");
  });

  it("says when nothing changed", () => {
    expect(summariseResult(computeResult("just lyrics", options()))).toBe(
      "C → D · no chords found to change"
    );
  });

  it("uses the semitone label in semitone mode", () => {
    const result = computeResult("C G", options({ mode: "semitone", semitones: 2 }));
    expect(summariseResult(result)).toBe("+2 semitones (♯) · 2 chords changed");
  });

  it("names the tonic in nashville mode", () => {
    const result = computeResult("C G Am F", options({ mode: "nashville" }));
    expect(summariseResult(result)).toBe("Nashville · key of C");
  });
});

describe("stageTitle", () => {
  it("shows the key pair", () => {
    expect(stageTitle(computeResult("C G", options()))).toBe("C → D");
  });

  it("shows the semitone label", () => {
    const result = computeResult("C G", options({ mode: "semitone", semitones: 2 }));
    expect(stageTitle(result)).toBe("+2 semitones (♯)");
  });

  it("names the nashville tonic", () => {
    const result = computeResult("C G Am F", options({ mode: "nashville" }));
    expect(stageTitle(result)).toBe("Nashville numbers · key of C");
  });
});

describe("resultChanges", () => {
  it("pairs each changed chord", () => {
    expect(resultChanges(computeResult("C G", options()))).toEqual([
      { from: "C", to: "D" },
      { from: "G", to: "A" },
    ]);
  });
});
