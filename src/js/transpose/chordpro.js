import {
  ChangeSet,
  CHORD_TOKEN_RE,
  lineUsesGerman,
  splitLineContents,
  splitLinesKeepEnds,
  transposeChord,
} from "./chords.js";
import { chooseSpelling } from "./notation.js";

const CHORDPRO_BRACKET_RE = /\[([^\]]+)\]/g;

export function bracketTokens(text) {
  return [...text.matchAll(CHORDPRO_BRACKET_RE)].map((match) => match[1]);
}

export function isChordProText(text) {
  for (const line of splitLineContents(text)) {
    for (const token of bracketTokens(line)) {
      if (CHORD_TOKEN_RE.test(token.trim())) return true;
    }
  }
  return false;
}

export function chordProUsesGerman(text) {
  for (const token of bracketTokens(text)) {
    const stripped = token.trim();
    if (CHORD_TOKEN_RE.test(stripped) && lineUsesGerman(stripped)) return true;
  }
  return false;
}

function transposeChordProLine(line, semitones, spelling, german, changes) {
  return line.replace(CHORDPRO_BRACKET_RE, (whole, token) => {
    if (!CHORD_TOKEN_RE.test(token.trim())) return whole;
    const transposed = transposeChord(token, semitones, spelling, german);
    if (transposed !== token) changes.add(token, transposed);
    return `[${transposed}]`;
  });
}

export function chordProToPlain(text) {
  let result = "";
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    const tokens = bracketTokens(content).map((token) => token.trim());
    result += tokens.join(" ") + ending;
  }
  return result;
}

export function transposeChordProCore(text, semitones, useFlats, german) {
  const spelling = chooseSpelling(useFlats, german);
  const changes = new ChangeSet();
  let result = "";
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    result += transposeChordProLine(content, semitones, spelling, german, changes) + ending;
  }
  return { text: result, changes: changes.sorted() };
}
