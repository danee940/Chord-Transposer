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
} from "./index";

interface KeyParams {
  current_key: string;
  target_key: string;
}

interface SemitoneParams {
  semitones: number;
  use_flats: boolean;
}

interface NashvilleParams {
  tonic_key: string;
}

type ParityCase = { description: string; input: string; expected: unknown } & (
  | { mode: "key" | "chordpro-key" | "chordpro-key-plain"; params: KeyParams }
  | { mode: "semitones" | "chordpro-semitones"; params: SemitoneParams }
  | { mode: "nashville"; params: NashvilleParams }
  | { mode: "to-plain" | "is-chordpro" | "detect-key"; params: Record<string, never> }
);

const parityCases = cases as ParityCase[];

function runCase({ mode, input, params }: ParityCase): unknown {
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
    expect(parityCases.length).toBeGreaterThan(0);
  });

  for (const testCase of parityCases) {
    it(testCase.description, () => {
      expect(runCase(testCase)).toEqual(testCase.expected);
    });
  }
});
