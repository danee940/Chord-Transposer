import { GERMAN_NOTE_NAMES, transposeNote, type Spelling } from "./notation";

export type Change = readonly [original: string, transposed: string];

export interface LineSegment {
  content: string;
  ending: string;
}

export interface TokenAffixes {
  leading: string;
  core: string;
  trailing: string;
}

export interface ChordParts {
  root: string;
  quality: string;
  bass: string | null;
  bassQuality: string;
}

export interface SpacedToken {
  token: string;
  trailing: string;
}

export interface SpacedLine {
  leading: string;
  tokens: SpacedToken[];
}

const ROOT_PATTERN =
  "(?:Cis|Des|Dis|Eis|Fis|Ges|Gis|Ais|His|Ces|Fes|Es|As|[A-Ga-g](?:#|b)?|[Hh]#?(?!b))";
const QUALITY_PATTERN = "(?:maj|min|dim|aug|sus|add|m|M|\\+|°|ø|\\d|#|b|-|\\(|\\)|,)*";

export const CHORD_TOKEN_RE = new RegExp(
  `^(${ROOT_PATTERN})(${QUALITY_PATTERN})(?:/(${ROOT_PATTERN})(${QUALITY_PATTERN}))?$`
);
const ROOT_PREFIX_RE = new RegExp(`^(${ROOT_PATTERN})`);

export const PUNCTUATION = "().,;:…\"'-";

export class ChangeSet {
  private readonly entries = new Map<string, Change>();

  add(original: string, transposed: string): void {
    this.entries.set(`${original}\u0000${transposed}`, [original, transposed]);
  }

  sorted(): Change[] {
    return [...this.entries.values()].sort((a, b) => {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      return a[1] < b[1] ? -1 : 1;
    });
  }
}

const LINE_BREAK_RE = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;
const WHITESPACE_RE = /\s+/;
const SPACED_TOKEN_RE = /(\S+)(\s*)/g;

export function splitLinesKeepEnds(text: string): LineSegment[] {
  const segments: LineSegment[] = [];
  let last = 0;
  LINE_BREAK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINE_BREAK_RE.exec(text)) !== null) {
    segments.push({ content: text.slice(last, match.index), ending: match[0] });
    last = LINE_BREAK_RE.lastIndex;
  }
  if (last < text.length) {
    segments.push({ content: text.slice(last), ending: "" });
  }
  return segments;
}

export function splitLineContents(text: string): string[] {
  return splitLinesKeepEnds(text).map((segment) => segment.content);
}

export function splitWhitespace(text: string): string[] {
  return text.split(WHITESPACE_RE).filter((token) => token.length > 0);
}

export function splitSpacedTokens(text: string): SpacedLine {
  const body = text.replace(/^\s+/, "");
  const leading = text.slice(0, text.length - body.length);
  const tokens: SpacedToken[] = [];
  SPACED_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPACED_TOKEN_RE.exec(body)) !== null) {
    tokens.push({ token: match[1]!, trailing: match[2]! });
  }
  return { leading, tokens };
}

function stripChars(text: string, chars: string): string {
  let start = 0;
  while (start < text.length && chars.includes(text.charAt(start))) start += 1;
  let end = text.length;
  while (end > start && chars.includes(text.charAt(end - 1))) end -= 1;
  return text.slice(start, end);
}

export function splitAffixes(token: string): TokenAffixes {
  let start = 0;
  while (start < token.length && PUNCTUATION.includes(token.charAt(start))) start += 1;
  let end = token.length;
  while (end > start && PUNCTUATION.includes(token.charAt(end - 1))) end -= 1;
  return {
    leading: token.slice(0, start),
    core: token.slice(start, end),
    trailing: token.slice(end),
  };
}

export function parseChordCore(core: string): ChordParts | null {
  const match = CHORD_TOKEN_RE.exec(core);
  if (match === null) return null;
  return {
    root: match[1]!,
    quality: match[2]!,
    bass: match[3] ?? null,
    bassQuality: match[4] ?? "",
  };
}

export function mapChordRoots(chord: string, mapRoot: (root: string) => string): string {
  const { leading, core, trailing } = splitAffixes(chord);
  const parts = parseChordCore(core);
  if (parts === null) return chord;
  const bass = parts.bass === null ? "" : `/${mapRoot(parts.bass)}${parts.bassQuality}`;
  return `${leading}${mapRoot(parts.root)}${parts.quality}${bass}${trailing}`;
}

export function transposeChord(
  chord: string,
  semitones: number,
  spelling: Spelling,
  german: boolean
): string {
  return mapChordRoots(chord, (root) => transposeNote(root, semitones, spelling, german));
}

export function isChordToken(token: string): boolean {
  const core = stripChars(token, PUNCTUATION);
  return core !== "" && CHORD_TOKEN_RE.test(core);
}

function isUpper(text: string): boolean {
  return text !== text.toLowerCase() && text === text.toUpperCase();
}

function isDecoration(token: string): boolean {
  const { core } = splitAffixes(token);
  if (core === "") return true;
  if (core.endsWith(":") || token.includes(":")) return true;
  return isUpper(core);
}

export function isChordLine(text: string): boolean {
  const tokens = splitWhitespace(text);
  if (tokens.length === 0) return false;
  let chordCount = 0;
  for (const token of tokens) {
    if (isChordToken(token)) {
      chordCount += 1;
    } else if (!isDecoration(token)) {
      return false;
    }
  }
  return chordCount > 0;
}

const GERMAN_ONLY_ROOTS = new Set(
  Object.keys(GERMAN_NOTE_NAMES)
    .filter((name) => name.length > 1)
    .map((name) => name.toUpperCase())
);
GERMAN_ONLY_ROOTS.add("H");

function* tokenRoots(token: string): Generator<string> {
  const { core } = splitAffixes(token);
  for (const part of core.split("/")) {
    const match = ROOT_PREFIX_RE.exec(part);
    if (match) yield match[1]!;
  }
}

export function lineUsesGerman(text: string): boolean {
  for (const token of splitWhitespace(text)) {
    for (const root of tokenRoots(token)) {
      if (GERMAN_ONLY_ROOTS.has(root.toUpperCase())) return true;
    }
  }
  return false;
}

export function transposeLineText(
  text: string,
  semitones: number,
  spelling: Spelling,
  german: boolean,
  changes: ChangeSet
): string {
  const { leading, tokens } = splitSpacedTokens(text);
  let result = leading;
  for (const { token, trailing } of tokens) {
    const transposed = isChordToken(token)
      ? transposeChord(token, semitones, spelling, german)
      : token;
    if (transposed !== token) changes.add(token, transposed);

    const diff = transposed.length - token.length;
    let spacing = trailing;
    if (diff > 0) {
      spacing = trailing.slice(Math.min(diff, trailing.length));
    } else if (diff < 0) {
      spacing = trailing + " ".repeat(-diff);
    }
    result += transposed + spacing;
  }
  return result;
}
