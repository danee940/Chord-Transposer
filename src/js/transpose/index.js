import {
  ChangeSet,
  isChordLine,
  lineUsesGerman,
  splitLineContents,
  splitLinesKeepEnds,
  transposeLineText,
} from "./chords.js";
import {
  chordProToPlain,
  chordProUsesGerman,
  isChordProText,
  transposeChordProCore,
} from "./chordpro.js";
import { detectKey } from "./detect.js";
import { nashvilleChordProLine, nashvilleLine } from "./nashville.js";
import {
  chooseSpelling,
  keyLabel,
  keySemitone,
  mod12,
  parseKey,
  prefersFlats,
} from "./notation.js";

export class InvalidKeyError extends Error {}

function requireKey(raw) {
  const parsed = parseKey(raw);
  if (parsed === null) {
    throw new InvalidKeyError(`'${raw}' is not a valid key.`);
  }
  return parsed;
}

function textUsesGerman(text) {
  for (const line of splitLineContents(text)) {
    if (isChordLine(line) && lineUsesGerman(line)) return true;
  }
  return false;
}

function transposeTextCore(text, semitones, useFlats) {
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

export function transposeText(text, currentKey, targetKey) {
  const current = requireKey(currentKey);
  const target = requireKey(targetKey);

  const german = textUsesGerman(text);
  const semitones = mod12(keySemitone(target.note, german) - keySemitone(current.note, german));
  const useFlats = prefersFlats(target.note, target.minor);

  const { text: result, changes } = transposeTextCore(text, semitones, useFlats);

  return {
    text: result,
    from: keyLabel(current.note, current.minor),
    to: keyLabel(target.note, target.minor),
    changes,
  };
}

export function transposeTextBySemitones(text, semitones, useFlats) {
  const normalised = mod12(semitones);
  const { text: result, changes } = transposeTextCore(text, normalised, useFlats);
  return { text: result, semitones: normalised, changes };
}

export function transposeChordProText(text, currentKey, targetKey) {
  const current = requireKey(currentKey);
  const target = requireKey(targetKey);

  const german = chordProUsesGerman(text);
  const semitones = mod12(keySemitone(target.note, german) - keySemitone(current.note, german));
  const useFlats = prefersFlats(target.note, target.minor);

  const { text: result, changes } = transposeChordProCore(text, semitones, useFlats, german);

  return {
    text: result,
    from: keyLabel(current.note, current.minor),
    to: keyLabel(target.note, target.minor),
    changes,
  };
}

export function transposeChordProTextBySemitones(text, semitones, useFlats) {
  const normalised = mod12(semitones);
  const german = chordProUsesGerman(text);
  const { text: result, changes } = transposeChordProCore(text, normalised, useFlats, german);
  return { text: result, semitones: normalised, changes };
}

export function textToNashville(text, tonicKey) {
  const tonic = requireKey(tonicKey);

  const chordpro = isChordProText(text);
  const german = chordpro ? chordProUsesGerman(text) : textUsesGerman(text);
  const tonicSemitone = keySemitone(tonic.note, german);

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
