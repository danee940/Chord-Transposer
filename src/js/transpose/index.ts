import {
  ChangeSet,
  isChordLine,
  lineUsesGerman,
  splitLineContents,
  splitLinesKeepEnds,
  transposeLineText,
  type Change,
} from "./chords";
import {
  chordProToPlain,
  chordProUsesGerman,
  isChordProText,
  transposeChordProCore,
  type TransposedCore,
} from "./chordpro";
import { detectKey, type KeyDetection } from "./detect";
import { nashvilleChordProLine, nashvilleLine } from "./nashville";
import {
  chooseSpelling,
  keyLabel,
  keySemitone,
  mod12,
  parseKey,
  prefersFlats,
  type ParsedKey,
} from "./notation";

export interface KeyTransposition {
  text: string;
  from: string;
  to: string;
  changes: Change[];
}

export interface SemitoneTransposition {
  text: string;
  semitones: number;
  changes: Change[];
}

export interface NashvilleConversion {
  text: string;
  tonic: string;
}

export class InvalidKeyError extends Error {}

function requireKey(raw: string): ParsedKey {
  const parsed = parseKey(raw);
  if (parsed === null) {
    throw new InvalidKeyError(`'${raw}' is not a valid key.`);
  }
  return parsed;
}

function textUsesGerman(text: string): boolean {
  for (const line of splitLineContents(text)) {
    if (isChordLine(line) && lineUsesGerman(line)) return true;
  }
  return false;
}

function keyDistance(current: ParsedKey, target: ParsedKey, german: boolean): number {
  return mod12(Number(keySemitone(target.note, german)) - Number(keySemitone(current.note, german)));
}

function transposeTextCore(text: string, semitones: number, useFlats: boolean): TransposedCore {
  const german = textUsesGerman(text);
  const spelling = chooseSpelling(useFlats, german);
  const changes = new ChangeSet();
  let result = "";
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    const transposed = isChordLine(content)
      ? transposeLineText(content, semitones, spelling, german, changes)
      : content;
    result += transposed + ending;
  }
  return { text: result, changes: changes.sorted() };
}

export function transposeText(text: string, currentKey: string, targetKey: string): KeyTransposition {
  const current = requireKey(currentKey);
  const target = requireKey(targetKey);

  const german = textUsesGerman(text);
  const semitones = keyDistance(current, target, german);
  const useFlats = prefersFlats(target.note, target.minor);

  const { text: result, changes } = transposeTextCore(text, semitones, useFlats);

  return {
    text: result,
    from: keyLabel(current.note, current.minor),
    to: keyLabel(target.note, target.minor),
    changes,
  };
}

export function transposeTextBySemitones(
  text: string,
  semitones: number,
  useFlats: boolean
): SemitoneTransposition {
  const normalised = mod12(semitones);
  const { text: result, changes } = transposeTextCore(text, normalised, useFlats);
  return { text: result, semitones: normalised, changes };
}

export function transposeChordProText(
  text: string,
  currentKey: string,
  targetKey: string
): KeyTransposition {
  const current = requireKey(currentKey);
  const target = requireKey(targetKey);

  const german = chordProUsesGerman(text);
  const semitones = keyDistance(current, target, german);
  const useFlats = prefersFlats(target.note, target.minor);

  const { text: result, changes } = transposeChordProCore(text, semitones, useFlats, german);

  return {
    text: result,
    from: keyLabel(current.note, current.minor),
    to: keyLabel(target.note, target.minor),
    changes,
  };
}

export function transposeChordProTextBySemitones(
  text: string,
  semitones: number,
  useFlats: boolean
): SemitoneTransposition {
  const normalised = mod12(semitones);
  const german = chordProUsesGerman(text);
  const { text: result, changes } = transposeChordProCore(text, normalised, useFlats, german);
  return { text: result, semitones: normalised, changes };
}

export function textToNashville(text: string, tonicKey: string): NashvilleConversion {
  const tonic = requireKey(tonicKey);

  const chordpro = isChordProText(text);
  const german = chordpro ? chordProUsesGerman(text) : textUsesGerman(text);
  const tonicSemitone = Number(keySemitone(tonic.note, german));

  let result = "";
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    let transposed = content;
    if (chordpro) {
      transposed = nashvilleChordProLine(content, tonicSemitone, german);
    } else if (isChordLine(content)) {
      transposed = nashvilleLine(content, tonicSemitone, german);
    }
    result += transposed + ending;
  }

  return { text: result, tonic: keyLabel(tonic.note, tonic.minor) };
}

export { chordProToPlain, detectKey, isChordProText };
export type { Change, KeyDetection };
