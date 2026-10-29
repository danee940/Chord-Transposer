export type Semitone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const SEMITONES: readonly Semitone[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export type Spelling = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface ParsedKey {
  note: string;
  minor: boolean;
}

export class UnknownNoteError extends Error {}

export const NOTE_TO_SEMITONE: Readonly<Record<string, Semitone>> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  "B#": 0,
  H: 11,
  "H#": 0,
};

export const GERMAN_NOTE_NAMES: Readonly<Record<string, Semitone>> = {
  C: 0,
  Cis: 1,
  Des: 1,
  D: 2,
  Dis: 3,
  Es: 3,
  Eis: 5,
  E: 4,
  Fes: 4,
  F: 5,
  Fis: 6,
  Ges: 6,
  G: 7,
  Gis: 8,
  As: 8,
  A: 9,
  Ais: 10,
  B: 10,
  His: 0,
  H: 11,
  Ces: 11,
};

export const GERMAN_NOTE_TO_SEMITONE: Readonly<Record<string, Semitone>> = {
  ...NOTE_TO_SEMITONE,
  B: 10,
  Bb: 9,
  ...GERMAN_NOTE_NAMES,
};

export const GERMAN_ROOT_NAMES: readonly string[] = Object.keys(GERMAN_NOTE_NAMES)
  .filter((name) => name.length > 1)
  .sort((a, b) => b.length - a.length);

export const GERMAN_ONLY_ROOTS_KEYS: ReadonlySet<string> = new Set(
  Object.keys(GERMAN_NOTE_NAMES).filter((name) => !(name in NOTE_TO_SEMITONE))
);

export const SHARP_KEYS: ReadonlySet<string> = new Set([
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "Em",
  "Bm",
  "F#m",
  "C#m",
  "G#m",
  "D#m",
  "A#m",
]);
export const FLAT_KEYS: ReadonlySet<string> = new Set([
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
  "Dm",
  "Gm",
  "Cm",
  "Fm",
  "Bbm",
  "Ebm",
  "Abm",
]);

export const SHARP_SPELLING: Spelling = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export const FLAT_SPELLING: Spelling = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

export const GERMAN_SHARP_SPELLING: Spelling = [
  "C",
  "Cis",
  "D",
  "Dis",
  "E",
  "F",
  "Fis",
  "G",
  "Gis",
  "A",
  "B",
  "H",
];
export const GERMAN_FLAT_SPELLING: Spelling = [
  "C",
  "Des",
  "D",
  "Es",
  "E",
  "F",
  "Ges",
  "G",
  "As",
  "A",
  "B",
  "H",
];

export function mod12(value: number): Semitone {
  return (((value % 12) + 12) % 12) as Semitone;
}

export function capitalizeFirst(text: string): string {
  if (text === "") return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function canonicalNote(note: string): string {
  return note.charAt(0).toUpperCase() + note.slice(1);
}

export function isMinorSuffix(rest: string): boolean {
  return ["m", "min", "minor"].includes(rest.trim().toLowerCase());
}

export function parseKey(raw: string): ParsedKey | null {
  const text = raw.trim();
  if (!text) return null;

  for (const name of GERMAN_ROOT_NAMES) {
    const segment = text.slice(0, name.length);
    if (segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() === name) {
      const rest = text.slice(name.length);
      if (rest === "" || isMinorSuffix(rest)) {
        return { note: name, minor: isMinorSuffix(rest) };
      }
    }
  }

  const root = text.charAt(0).toUpperCase();
  let rest = text.slice(1);
  let accidental = "";
  if (rest && (rest.charAt(0) === "#" || rest.charAt(0) === "b")) {
    accidental = rest.charAt(0);
    rest = rest.slice(1);
  }
  const note = root + accidental;
  if (!(note in NOTE_TO_SEMITONE)) return null;
  return { note, minor: isMinorSuffix(rest) };
}

export function keyLabel(note: string, minor: boolean): string {
  return note + (minor ? "m" : "");
}

export function prefersFlats(targetNote: string, targetMinor: boolean): boolean {
  const label = keyLabel(targetNote, targetMinor);
  if (FLAT_KEYS.has(label) || FLAT_KEYS.has(targetNote)) return true;
  if (SHARP_KEYS.has(label) || SHARP_KEYS.has(targetNote)) return false;
  return true;
}

export function chooseSpelling(useFlats: boolean, german: boolean): Spelling {
  if (german) return useFlats ? GERMAN_FLAT_SPELLING : GERMAN_SHARP_SPELLING;
  return useFlats ? FLAT_SPELLING : SHARP_SPELLING;
}

const NATURAL_LETTER_SEMITONES: Readonly<Record<string, Semitone>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const LETTER_ORDER = "CDEFGAB";
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;

function spellLetter(letter: string, accidental: number, german: boolean): string {
  if (!german) {
    return letter + (accidental === 1 ? "#" : accidental === -1 ? "b" : "");
  }
  if (accidental === 1) return letter === "B" ? "His" : `${letter}is`;
  if (accidental === -1) {
    if (letter === "B") return "B";
    if (letter === "E" || letter === "A") return `${letter}s`;
    return `${letter}es`;
  }
  return letter === "B" ? "H" : letter;
}

export function keySpelling(note: string, minor: boolean, german: boolean): Spelling {
  // Diatonic notes of the target key's major or natural minor scale are
  // spelled by scale degree (e.g. Cb in Gb major, E# in F# major), and minor
  // keys also spell their harmonic-minor leading tone as a raised seventh
  // (C# in D minor, E# in F# minor). The rest keep the key's conventional
  // sharp or flat spelling, and degrees that would need a double accidental
  // fall back to it.
  const spelling = [...chooseSpelling(prefersFlats(note, minor), german)];
  let letter = note.charAt(0).toUpperCase();
  if (letter === "H") letter = "B";
  const tonic = keySemitone(note, german);
  const intervals = minor ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
  const start = LETTER_ORDER.indexOf(letter);
  const degrees: Array<[degree: number, interval: number]> = intervals.map((interval, degree) => [
    degree,
    interval,
  ]);
  if (minor) degrees.push([6, 11]);
  for (const [degree, interval] of degrees) {
    const semitone = mod12(tonic + interval);
    const degreeLetter = LETTER_ORDER.charAt((start + degree) % 7);
    const accidental =
      (mod12(semitone - NATURAL_LETTER_SEMITONES[degreeLetter]! + 6) as number) - 6;
    if (accidental >= -1 && accidental <= 1) {
      spelling[semitone] = spellLetter(degreeLetter, accidental, german);
    }
  }
  return spelling as unknown as Spelling;
}

export function noteSemitone(note: string, german: boolean): Semitone {
  const table = german ? GERMAN_NOTE_TO_SEMITONE : NOTE_TO_SEMITONE;
  const semitone = table[canonicalNote(note)];
  if (semitone === undefined) throw new UnknownNoteError(`'${note}' is not a known note.`);
  return semitone;
}

export function keySemitone(note: string, german: boolean): Semitone {
  if (GERMAN_ONLY_ROOTS_KEYS.has(canonicalNote(note))) return noteSemitone(note, true);
  return noteSemitone(note, german);
}

export function transposeNote(
  note: string,
  semitones: number,
  spelling: Spelling,
  german: boolean
): string {
  return spelling[mod12(noteSemitone(note, german) + semitones)];
}
