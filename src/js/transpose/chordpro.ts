import {
  ChangeSet,
  CHORD_TOKEN_RE,
  lineUsesGerman,
  splitLineContents,
  splitLinesKeepEnds,
  transposeChord,
  type Change,
} from "./chords";
import type { Spelling } from "./notation";

export interface TransposedCore {
  text: string;
  changes: Change[];
}

export const CHORDPRO_BRACKET_RE = /\[([^\]]+)\]/g;

export function bracketTokens(text: string): string[] {
  return [...text.matchAll(CHORDPRO_BRACKET_RE)].map((match) => match[1]!);
}

export function isChordProText(text: string): boolean {
  for (const line of splitLineContents(text)) {
    for (const token of bracketTokens(line)) {
      if (CHORD_TOKEN_RE.test(token.trim())) return true;
    }
  }
  return false;
}

export function chordProUsesGerman(text: string): boolean {
  for (const token of bracketTokens(text)) {
    const stripped = token.trim();
    if (CHORD_TOKEN_RE.test(stripped) && lineUsesGerman(stripped)) return true;
  }
  return false;
}

function transposeChordProLine(
  line: string,
  semitones: number,
  spelling: Spelling,
  german: boolean,
  changes: ChangeSet
): string {
  return line.replace(CHORDPRO_BRACKET_RE, (whole: string, token: string) => {
    if (!CHORD_TOKEN_RE.test(token.trim())) return whole;
    const transposed = transposeChord(token, semitones, spelling, german);
    if (transposed !== token) changes.add(token, transposed);
    return `[${transposed}]`;
  });
}

export function chordProToPlain(text: string): string {
  let result = "";
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    const tokens = bracketTokens(content).map((token) => token.trim());
    result += tokens.join(" ") + ending;
  }
  return result;
}

export function transposeChordProCore(
  text: string,
  semitones: number,
  spelling: Spelling,
  german: boolean
): TransposedCore {
  const changes = new ChangeSet();
  let result = "";
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    result += transposeChordProLine(content, semitones, spelling, german, changes) + ending;
  }
  return { text: result, changes: changes.sorted() };
}
