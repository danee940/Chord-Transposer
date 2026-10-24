import { describe, expect, it } from "vitest";

import cases from "../../testdata/transpose_cases.json";
import {
  chordProToPlain,
  detectKey,
  isChordProText,
  textToNashville,
  transposeChordProText,
  transposeChordProTextBySemitones,
  transposeText,
  transposeTextBySemitones,
} from "./index.js";

function runCase({ mode, input, params }) {
  if (mode === "key") {
    const { text, from, to, changes } = transposeText(input, params.current_key, params.target_key);
    return { text, from, to, changes };
  }
  if (mode === "semitones") {
    const { text, semitones, changes } = transposeTextBySemitones(
      input,
      params.semitones,
      params.use_flats
    );
    return { text, semitones, changes };
  }
  if (mode === "chordpro-key") {
    const { text, from, to, changes } = transposeChordProText(
      input,
      params.current_key,
      params.target_key
    );
    return { text, from, to, changes };
  }
  if (mode === "chordpro-semitones") {
    const { text, semitones, changes } = transposeChordProTextBySemitones(
      input,
      params.semitones,
      params.use_flats
    );
    return { text, semitones, changes };
  }
  if (mode === "chordpro-key-plain") {
    const { text, from, to, changes } = transposeChordProText(
      input,
      params.current_key,
      params.target_key
    );
    return { text: chordProToPlain(text), from, to, changes };
  }
  if (mode === "to-plain") {
    return { text: chordProToPlain(input) };
  }
  if (mode === "is-chordpro") {
    return { result: isChordProText(input) };
  }
  if (mode === "detect-key") {
    return detectKey(input);
  }
  if (mode === "nashville") {
    const { text, tonic } = textToNashville(input, params.tonic_key);
    return { text, tonic };
  }
  throw new Error(`unknown mode: ${mode}`);
}

describe("JS transpose core parity", () => {
  it("loads a non-empty fixture", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const testCase of cases) {
    it(testCase.description, () => {
      expect(runCase(testCase)).toEqual(testCase.expected);
    });
  }
});
