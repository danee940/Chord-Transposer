import { CHORD_TOKEN_RE, isChordToken, ROOT_MATCH_RE, splitAffixes } from "./chords";
import { mod12, noteSemitone } from "./notation";

const MAJOR_SCALE_DEGREES: Readonly<Record<number, string>> = {
  0: "1",
  2: "2",
  4: "3",
  5: "4",
  7: "5",
  9: "6",
  11: "7",
};
const CHROMATIC_DEGREE_NAMES: Readonly<Record<number, string>> = {
  1: "b2",
  3: "b3",
  6: "b5",
  8: "b6",
  10: "b7",
};

const CHORDPRO_BRACKET_RE = /\[([^\]]+)\]/g;

export function noteToNashvilleDegree(
  note: string,
  tonicSemitone: number,
  german: boolean
): string | undefined {
  const degree = mod12(Number(noteSemitone(note, german)) - tonicSemitone);
  if (degree in MAJOR_SCALE_DEGREES) return MAJOR_SCALE_DEGREES[degree];
  return CHROMATIC_DEGREE_NAMES[degree];
}

export function chordToNashville(chord: string, tonicSemitone: number, german: boolean): string {
  const { leading, core, trailing } = splitAffixes(chord);
  if (core !== chord) {
    if (!CHORD_TOKEN_RE.test(core)) return chord;
    return leading + chordToNashville(core, tonicSemitone, german) + trailing;
  }

  const match = ROOT_MATCH_RE.exec(chord);
  if (!match) return chord;
  const root = match[1]!;
  const remainder = match[2]!;
  const number = noteToNashvilleDegree(root, tonicSemitone, german);

  const slashIndex = remainder.indexOf("/");
  if (slashIndex !== -1) {
    const beforeSlash = remainder.slice(0, slashIndex);
    const bass = remainder.slice(slashIndex + 1);
    const bassMatch = ROOT_MATCH_RE.exec(bass);
    if (bassMatch) {
      const bassNumber = noteToNashvilleDegree(bassMatch[1]!, tonicSemitone, german);
      return `${number}${beforeSlash}/${bassNumber}${bassMatch[2]}`;
    }
  }
  return `${number}${remainder}`;
}

export function nashvilleLine(line: string, tonicSemitone: number, german: boolean): string {
  const stripped = line.replace(/^\s+/, "");
  const leading = line.slice(0, line.length - stripped.length);
  let result = leading;

  const tokenSplit = /(\S+)(\s*)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenSplit.exec(line.slice(leading.length))) !== null) {
    let token = match[1]!;
    const trailing = match[2]!;
    if (isChordToken(token)) token = chordToNashville(token, tonicSemitone, german);
    result += token + trailing;
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
