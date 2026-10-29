import { ROOT_MATCH_RE, isChordToken, splitAffixes } from "../transpose/chords";
import { GERMAN_SHARP_SPELLING, SHARP_SPELLING, keySemitone, mod12 } from "../transpose/notation";

export type Instrument = "guitar" | "ukulele" | "piano";
export type FrettedInstrument = Exclude<Instrument, "piano">;

export type ChordFamily =
  | "maj"
  | "min"
  | "dom7"
  | "min7"
  | "maj7"
  | "dim"
  | "dim7"
  | "aug"
  | "sus2"
  | "sus4"
  | "min7b5"
  | "maj6"
  | "min6"
  | "dom9"
  | "min9"
  | "add9";

export interface ParsedChord {
  raw: string;
  rootName: string;
  rootSemitone: number;
  quality: string;
  family: ChordFamily;
  bassName: string;
  bassSemitone: number | null;
  german: boolean;
}

export interface PianoShape {
  kind: "piano";
  notes: string[];
  rootSemitone: number;
}

export interface FrettedShape {
  kind: "fretted";
  instrument: FrettedInstrument;
  frets: number[];
}

export type ChordShape = PianoShape | FrettedShape;

type OpenShapeEntry = readonly [root: string, family: ChordFamily, frets: number[]];

interface BarreTemplate {
  rootOpenSemitone: number;
  families: Partial<Record<ChordFamily, number[]>>;
}

export const INSTRUMENT_LABELS: Readonly<Record<Instrument, string>> = {
  guitar: "Guitar",
  ukulele: "Ukulele",
  piano: "Piano",
};

export const QUALITY_INTERVALS: Readonly<Record<ChordFamily, number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  min7b5: [0, 3, 6, 10],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  dom9: [0, 4, 7, 10, 14],
  min9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
};

export const QUALITY_LABELS: Readonly<Record<ChordFamily, string>> = {
  maj: "major",
  min: "minor",
  dom7: "dominant 7th",
  min7: "minor 7th",
  maj7: "major 7th",
  dim: "diminished",
  dim7: "diminished 7th",
  aug: "augmented",
  sus2: "suspended 2nd",
  sus4: "suspended 4th",
  min7b5: "half-diminished",
  maj6: "sixth",
  min6: "minor sixth",
  dom9: "ninth",
  min9: "minor ninth",
  add9: "added ninth",
};

const FRETTED_FAMILIES: ReadonlySet<ChordFamily> = new Set<ChordFamily>([
  "maj",
  "min",
  "dom7",
  "min7",
  "maj7",
  "dim",
  "dim7",
  "aug",
  "sus2",
  "sus4",
  "min7b5",
  "maj6",
  "min6",
  "dom9",
  "min9",
  "add9",
]);

function rootSemitone(name: string, german: boolean): number | null {
  const semitone = keySemitone(name, german);
  return semitone === undefined ? null : semitone;
}

export function classifyQuality(quality: string): ChordFamily {
  const s = quality.trim();
  if (s === "") return "maj";
  if (/dim7|°7|o7/i.test(s)) return "dim7";
  if (/m7b5|min7b5|ø|m7-5/i.test(s)) return "min7b5";
  if (/maj7|maj9|M7|Δ/.test(s)) return "maj7";
  if (/^(m|min|-)(?!aj)/.test(s)) {
    if (/7/.test(s)) return "min7";
    if (/9/.test(s)) return "min9";
    if (/6/.test(s)) return "min6";
    return "min";
  }
  if (/dim|°/i.test(s)) return "dim";
  if (/aug|\+|#5/.test(s)) return "aug";
  if (/sus2/i.test(s)) return "sus2";
  if (/sus/i.test(s)) return "sus4";
  if (/add9/i.test(s)) return "add9";
  if (/maj6|(?<![m/])6/.test(s)) return "maj6";
  if (/9/.test(s)) return "dom9";
  if (/7/.test(s)) return "dom7";
  return "maj";
}

export function parseChordSymbol(token: string, german = false): ParsedChord | null {
  const { core } = splitAffixes(token);
  if (core === "" || !isChordToken(core)) return null;

  const slashIndex = core.indexOf("/");
  const head = slashIndex === -1 ? core : core.slice(0, slashIndex);
  const bassText = slashIndex === -1 ? "" : core.slice(slashIndex + 1);

  const match = ROOT_MATCH_RE.exec(head);
  if (!match) return null;
  const rootName = match[1]!;
  const quality = match[2]!;
  const semitone = rootSemitone(rootName, german);
  if (semitone === null) return null;

  let bassName = "";
  let bassSemitone: number | null = null;
  if (bassText !== "") {
    const bassMatch = ROOT_MATCH_RE.exec(bassText);
    if (bassMatch) {
      const bassValue = rootSemitone(bassMatch[1]!, german);
      if (bassValue !== null) {
        bassName = bassMatch[1]!;
        bassSemitone = bassValue;
      }
    }
  }

  return {
    raw: core,
    rootName,
    rootSemitone: semitone,
    quality,
    family: classifyQuality(quality),
    bassName,
    bassSemitone,
    german,
  };
}

export function chordNotes(chord: ParsedChord): string[] {
  const intervals = QUALITY_INTERVALS[chord.family] || QUALITY_INTERVALS.maj;
  const spelling = chord.german ? GERMAN_SHARP_SPELLING : SHARP_SPELLING;
  const notes = intervals.map((interval) => spelling[mod12(chord.rootSemitone + interval)]!);
  if (chord.bassSemitone !== null) {
    const bass = spelling[mod12(chord.bassSemitone)]!;
    if (!notes.includes(bass)) notes.unshift(bass);
  }
  return notes;
}

const GUITAR_OPEN: readonly OpenShapeEntry[] = [
  ["C", "maj", [-1, 3, 2, 0, 1, 0]],
  ["C", "dom7", [-1, 3, 2, 3, 1, 0]],
  ["C", "maj7", [-1, 3, 2, 0, 0, 0]],
  ["D", "maj", [-1, -1, 0, 2, 3, 2]],
  ["D", "min", [-1, -1, 0, 2, 3, 1]],
  ["D", "dom7", [-1, -1, 0, 2, 1, 2]],
  ["D", "min7", [-1, -1, 0, 2, 1, 1]],
  ["D", "maj7", [-1, -1, 0, 2, 2, 2]],
  ["E", "maj", [0, 2, 2, 1, 0, 0]],
  ["E", "min", [0, 2, 2, 0, 0, 0]],
  ["E", "dom7", [0, 2, 0, 1, 0, 0]],
  ["E", "min7", [0, 2, 0, 0, 0, 0]],
  ["E", "maj7", [0, 2, 1, 1, 0, 0]],
  ["F", "maj", [1, 3, 3, 2, 1, 1]],
  ["F", "maj7", [-1, -1, 3, 2, 1, 0]],
  ["G", "maj", [3, 2, 0, 0, 0, 3]],
  ["G", "dom7", [3, 2, 0, 0, 0, 1]],
  ["G", "maj7", [3, 2, 0, 0, 0, 2]],
  ["A", "maj", [-1, 0, 2, 2, 2, 0]],
  ["A", "min", [-1, 0, 2, 2, 1, 0]],
  ["A", "dom7", [-1, 0, 2, 0, 2, 0]],
  ["A", "min7", [-1, 0, 2, 0, 1, 0]],
  ["A", "maj7", [-1, 0, 2, 1, 2, 0]],
  ["B", "dom7", [-1, 2, 1, 2, 0, 2]],
];

const UKULELE_OPEN: readonly OpenShapeEntry[] = [
  ["C", "maj", [0, 0, 0, 3]],
  ["C", "dom7", [0, 0, 0, 1]],
  ["C", "maj7", [0, 0, 0, 2]],
  ["C", "min", [0, 3, 3, 3]],
  ["D", "maj", [2, 2, 2, 0]],
  ["D", "min", [2, 2, 1, 0]],
  ["D", "dom7", [2, 0, 2, 0]],
  ["E", "maj", [1, 4, 0, 2]],
  ["E", "min", [0, 4, 3, 2]],
  ["E", "dom7", [1, 2, 0, 2]],
  ["F", "maj", [2, 0, 1, 0]],
  ["F", "dom7", [2, 3, 1, 3]],
  ["G", "maj", [0, 2, 3, 2]],
  ["G", "min", [0, 2, 3, 1]],
  ["G", "dom7", [0, 2, 1, 2]],
  ["A", "maj", [2, 1, 0, 0]],
  ["A", "min", [2, 0, 0, 0]],
  ["A", "dom7", [0, 1, 0, 0]],
  ["A", "min7", [0, 0, 0, 0]],
  ["B", "dom7", [2, 3, 2, 2]],
];

const GUITAR_BARRE_TEMPLATES: Readonly<Record<string, BarreTemplate>> = {
  E: {
    rootOpenSemitone: 4,
    families: {
      maj: [0, 2, 2, 1, 0, 0],
      min: [0, 2, 2, 0, 0, 0],
      dom7: [0, 2, 0, 1, 0, 0],
      min7: [0, 2, 0, 0, 0, 0],
      maj7: [0, 2, 1, 1, 0, 0],
    },
  },
  A: {
    rootOpenSemitone: 9,
    families: {
      maj: [-1, 0, 2, 2, 2, 0],
      min: [-1, 0, 2, 2, 1, 0],
      dom7: [-1, 0, 2, 0, 2, 0],
      min7: [-1, 0, 2, 0, 1, 0],
      maj7: [-1, 0, 2, 1, 2, 0],
      dim: [-1, 0, 1, 2, 1, -1],
      dim7: [-1, 0, 1, 2, 1, 2],
      aug: [-1, 0, 3, 2, 2, 1],
      sus2: [-1, 0, 2, 2, 0, 0],
      sus4: [-1, 0, 2, 2, 3, 0],
      min7b5: [-1, 0, 1, 0, 1, -1],
      maj6: [-1, 0, 2, 2, 2, 2],
      min6: [-1, 0, 2, 2, 1, 2],
      dom9: [-1, 0, -1, 0, 0, 0],
      min9: [-1, 0, -1, 0, 0, 1],
      add9: [-1, 0, 2, 4, 0, 0],
    },
  },
};

function buildOpenIndex(entries: readonly OpenShapeEntry[], german: boolean): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (const [name, family, frets] of entries) {
    const semitone = rootSemitone(name, german);
    index.set(`${semitone}:${family}`, frets);
  }
  return index;
}

const GUITAR_OPEN_INDEX = buildOpenIndex(GUITAR_OPEN, false);
const UKULELE_OPEN_INDEX = buildOpenIndex(UKULELE_OPEN, false);

function applyBarreTemplate(template: number[], fret: number): number[] {
  return template.map((offset) => (offset < 0 ? -1 : offset + fret));
}

function guitarBarreShape(rootSemitoneValue: number, family: ChordFamily): number[] | null {
  if (!FRETTED_FAMILIES.has(family)) return null;
  const candidates: { fret: number; frets: number[] }[] = [];
  for (const shape of Object.values(GUITAR_BARRE_TEMPLATES)) {
    const template = shape.families[family];
    if (!template) continue;
    const fret = mod12(rootSemitoneValue - shape.rootOpenSemitone);
    candidates.push({ fret, frets: applyBarreTemplate(template, fret) });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.fret - b.fret);
  return candidates[0]!.frets;
}

function frettedShape(instrument: FrettedInstrument, chord: ParsedChord): { frets: number[] } | null {
  const index = instrument === "guitar" ? GUITAR_OPEN_INDEX : UKULELE_OPEN_INDEX;
  const open = index.get(`${chord.rootSemitone}:${chord.family}`);
  if (open) return { frets: open };
  if (instrument === "guitar") {
    const barre = guitarBarreShape(chord.rootSemitone, chord.family);
    if (barre) return { frets: barre };
  }
  return null;
}

export function lookupShape(chord: ParsedChord | null, instrument: Instrument): ChordShape | null {
  if (chord === null) return null;
  if (instrument === "piano") {
    return { kind: "piano", notes: chordNotes(chord), rootSemitone: chord.rootSemitone };
  }
  const fretted = frettedShape(instrument, chord);
  if (fretted === null) return null;
  return { kind: "fretted", instrument, ...fretted };
}
