import {
  isChordLine,
  lineUsesGerman,
  parseChordCore,
  splitAffixes,
  splitLineContents,
  splitWhitespace,
  type ChordParts,
} from "./chords";
import { bracketTokens, chordProUsesGerman, isChordProText } from "./chordpro";
import {
  chooseSpelling,
  FLAT_KEYS,
  FLAT_SPELLING,
  keyLabel,
  mod12,
  noteSemitone,
  SEMITONES,
  SHARP_KEYS,
  SHARP_SPELLING,
  type Semitone,
} from "./notation";

export interface KeyDetection {
  key: string | null;
  alternate: string | null;
  ambiguous: boolean;
  chords: number;
  distinct: number;
}

type ChordQuality = "major" | "minor" | "dom7" | "dim" | "other";

type DegreeFits = Readonly<Record<ChordQuality, number>>;

interface DetectedChord extends ChordParts {
  lineLast: boolean;
}

interface Observation {
  semitone: Semitone;
  quality: ChordQuality;
  weight: number;
}

interface KeyCandidate {
  score: number;
  minor: boolean;
  tonic: Semitone;
}

const DETECT_MIN_CHORDS = 3;
const DETECT_MIN_DISTINCT_ROOTS = 2;
const DETECT_AMBIGUITY_PERCENT = 15;
const DETECT_BASE_WEIGHT = 2;
const DETECT_EDGE_BONUS = 3;
const DETECT_LINE_END_BONUS = 1;

const OUT_OF_SCALE_FIT = -3;

const MAJOR_DEGREE_FITS: Readonly<Partial<Record<Semitone, DegreeFits>>> = {
  0: { major: 6, dom7: 4, other: 4, minor: 1, dim: 1 },
  2: { minor: 3, dom7: 2, other: 2, major: 1, dim: 1 },
  4: { minor: 3, major: 1, dom7: 1, other: 1, dim: 1 },
  5: { major: 4, other: 3, minor: 2, dom7: 1, dim: 1 },
  7: { dom7: 6, major: 5, other: 4, minor: 1, dim: 1 },
  9: { minor: 3, major: 1, dom7: 1, other: 1, dim: 1 },
  10: { major: 2, dom7: 0, other: 0, minor: 0, dim: 0 },
  11: { dim: 3, major: 1, minor: 1, dom7: 1, other: 1 },
};

const MINOR_DEGREE_FITS: Readonly<Partial<Record<Semitone, DegreeFits>>> = {
  0: { minor: 6, other: 4, major: 1, dom7: 1, dim: 1 },
  2: { dim: 2, minor: 2, major: 1, dom7: 1, other: 1 },
  3: { major: 4, other: 2, dom7: 2, minor: 1, dim: 1 },
  5: { minor: 4, major: 2, dom7: 2, other: 2, dim: 1 },
  7: { dom7: 6, major: 5, minor: 4, other: 3, dim: 1 },
  8: { major: 3, other: 2, minor: 1, dom7: 1, dim: 1 },
  10: { major: 3, dom7: 2, other: 2, minor: 1, dim: 1 },
  11: { dim: 2, major: 1, minor: 1, dom7: 1, other: 1 },
};

export function isKeyDetection(value: unknown): value is KeyDetection {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const isNullableString = (field: unknown) => field === null || typeof field === "string";
  return (
    isNullableString(record.key) &&
    isNullableString(record.alternate) &&
    typeof record.ambiguous === "boolean" &&
    typeof record.chords === "number" &&
    typeof record.distinct === "number"
  );
}

function chordQuality(quality: string): ChordQuality {
  if (quality === "") return "major";
  const low = quality.toLowerCase();
  if (low.startsWith("maj")) return "major";
  if (low.startsWith("dim")) return "dim";
  const first = quality.charAt(0);
  if (first === "°" || first === "ø") return "dim";
  if (first === "M") return "major";
  if (first === "m" || first === "-") return "minor";
  if (first === "7" || first === "9" || first === "1") return "dom7";
  return "other";
}

function withLinePositions(chords: ChordParts[]): DetectedChord[] {
  return chords.map((parts, index) => ({ ...parts, lineLast: index === chords.length - 1 }));
}

function detectChords(text: string): { chords: DetectedChord[]; german: boolean } {
  const chords: DetectedChord[] = [];
  if (isChordProText(text)) {
    for (const line of splitLineContents(text)) {
      const parsed = bracketTokens(line)
        .map((token) => parseChordCore(token.trim()))
        .filter((parts) => parts !== null);
      chords.push(...withLinePositions(parsed));
    }
    return { chords, german: chordProUsesGerman(text) };
  }

  let german = false;
  for (const line of splitLineContents(text)) {
    if (!isChordLine(line)) continue;
    if (lineUsesGerman(line)) german = true;
    const parsed = splitWhitespace(line)
      .map((token) => parseChordCore(splitAffixes(token).core))
      .filter((parts) => parts !== null);
    chords.push(...withLinePositions(parsed));
  }
  return { chords, german };
}

function detectObservations(text: string): {
  observations: Observation[];
  german: boolean;
  total: number;
  distinct: number;
} {
  const { chords, german } = detectChords(text);
  const hasUpper = chords.some(({ root }) => root.charAt(0) === root.charAt(0).toUpperCase());
  const hasLower = chords.some(({ root }) => root.charAt(0) === root.charAt(0).toLowerCase());
  const lowercaseMeansMinor = hasUpper && hasLower;

  const observations: Observation[] = [];
  const roots = new Set<Semitone>();
  chords.forEach(({ root, quality, lineLast }, index) => {
    const semitone = noteSemitone(root, german);
    let chordKind = chordQuality(quality);
    if (
      lowercaseMeansMinor &&
      root.charAt(0) === root.charAt(0).toLowerCase() &&
      chordKind === "major"
    ) {
      chordKind = "minor";
    }
    let weight = DETECT_BASE_WEIGHT;
    if (index === 0) weight += DETECT_EDGE_BONUS;
    if (index === chords.length - 1) weight += DETECT_EDGE_BONUS;
    if (lineLast) weight += DETECT_LINE_END_BONUS;
    observations.push({ semitone, quality: chordKind, weight });
    roots.add(semitone);
  });
  return { observations, german, total: observations.length, distinct: roots.size };
}

function scoreKeyCandidates(observations: Observation[]): KeyCandidate[] {
  const candidates: KeyCandidate[] = [];
  for (const minor of [false, true]) {
    const fits = minor ? MINOR_DEGREE_FITS : MAJOR_DEGREE_FITS;
    for (const tonic of SEMITONES) {
      let score = 0;
      for (const { semitone, quality, weight } of observations) {
        const degreeFits = fits[mod12(semitone - tonic)];
        score += weight * (degreeFits ? degreeFits[quality] : OUT_OF_SCALE_FIT);
      }
      candidates.push({ score, minor, tonic });
    }
  }
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.minor !== b.minor) return Number(a.minor) - Number(b.minor);
    return a.tonic - b.tonic;
  });
  return candidates;
}

function spellDetectedKey(semitone: Semitone, minor: boolean, german: boolean): string {
  const flatLabel = keyLabel(FLAT_SPELLING[semitone], minor);
  const sharpLabel = keyLabel(SHARP_SPELLING[semitone], minor);
  let useFlats = true;
  if (FLAT_KEYS.has(flatLabel)) {
    useFlats = true;
  } else if (SHARP_KEYS.has(sharpLabel)) {
    useFlats = false;
  }
  return keyLabel(chooseSpelling(useFlats, german)[semitone], minor);
}

export function detectKey(text: string): KeyDetection {
  const { observations, german, total, distinct } = detectObservations(text);
  const result: KeyDetection = {
    key: null,
    alternate: null,
    ambiguous: false,
    chords: total,
    distinct,
  };
  if (total < DETECT_MIN_CHORDS || distinct < DETECT_MIN_DISTINCT_ROOTS) return result;

  const [best, second] = scoreKeyCandidates(observations) as [KeyCandidate, KeyCandidate];
  result.key = spellDetectedKey(best.tonic, best.minor, german);
  result.ambiguous = (best.score - second.score) * 100 < DETECT_AMBIGUITY_PERCENT * best.score;
  if (result.ambiguous) {
    result.alternate = spellDetectedKey(second.tonic, second.minor, german);
  }
  return result;
}
