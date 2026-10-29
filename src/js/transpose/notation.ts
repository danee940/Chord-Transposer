export type Spelling = readonly string[];

export interface ParsedKey {
  note: string;
  minor: boolean;
}

export const NOTE_TO_SEMITONE: Readonly<Record<string, number>> = {
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

export const GERMAN_NOTE_NAMES: Readonly<Record<string, number>> = {
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

export const GERMAN_NOTE_TO_SEMITONE: Readonly<Record<string, number>> = {
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

export const SHARP_SPELLING: Spelling = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_SPELLING: Spelling = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const GERMAN_SHARP_SPELLING: Spelling = ["C", "Cis", "D", "Dis", "E", "F", "Fis", "G", "Gis", "A", "B", "H"];
export const GERMAN_FLAT_SPELLING: Spelling = ["C", "Des", "D", "Es", "E", "F", "Ges", "G", "As", "A", "B", "H"];

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

function capitalizeFirst(text: string): string {
  if (text === "") return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function canonicalNote(note: string): string {
  return note.charAt(0).toUpperCase() + note.slice(1);
}

function isMinorSuffix(rest: string): boolean {
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

export function noteSemitone(note: string, german: boolean): number | undefined {
  const key = canonicalNote(note);
  const table = german ? GERMAN_NOTE_TO_SEMITONE : NOTE_TO_SEMITONE;
  return table[key];
}

export function keySemitone(note: string, german: boolean): number | undefined {
  const canonical = canonicalNote(note);
  if (GERMAN_ONLY_ROOTS_KEYS.has(canonical)) {
    return GERMAN_NOTE_TO_SEMITONE[canonical];
  }
  return noteSemitone(note, german);
}

export function transposeNote(note: string, semitones: number, spelling: Spelling, german: boolean): string {
  const semitone = mod12(Number(noteSemitone(note, german)) + semitones);
  return String(spelling[semitone]);
}

export { capitalizeFirst, isMinorSuffix, mod12 };
