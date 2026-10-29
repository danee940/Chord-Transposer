import { CHORD_TOKEN_RE, isChordToken, mapChordRoots, splitSpacedTokens } from "./chords";
import { CHORDPRO_BRACKET_RE } from "./chordpro";
import { mod12, noteSemitone, type Semitone } from "./notation";

const DEGREE_NAMES: Readonly<Record<Semitone, string>> = {
  0: "1",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "b5",
  7: "5",
  8: "b6",
  9: "6",
  10: "b7",
  11: "7",
};

export function noteToNashvilleDegree(
  note: string,
  tonicSemitone: number,
  german: boolean
): string {
  return DEGREE_NAMES[mod12(noteSemitone(note, german) - tonicSemitone)];
}

export function chordToNashville(chord: string, tonicSemitone: number, german: boolean): string {
  return mapChordRoots(chord, (root) => noteToNashvilleDegree(root, tonicSemitone, german));
}

export function nashvilleLine(line: string, tonicSemitone: number, german: boolean): string {
  const { leading, tokens } = splitSpacedTokens(line);
  let result = leading;
  for (const { token, trailing } of tokens) {
    const converted = isChordToken(token) ? chordToNashville(token, tonicSemitone, german) : token;
    result += converted + trailing;
  }
  return result;
}

export function nashvilleChordProLine(
  line: string,
  tonicSemitone: number,
  german: boolean
): string {
  return line.replace(CHORDPRO_BRACKET_RE, (whole: string, token: string) => {
    if (!CHORD_TOKEN_RE.test(token.trim())) return whole;
    return `[${chordToNashville(token, tonicSemitone, german)}]`;
  });
}
