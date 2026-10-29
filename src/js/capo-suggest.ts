export interface CapoShape {
  semitone: number;
  major: string;
  minor: string;
}

export interface CapoOption {
  fret: number;
  shape: string;
}

export interface CapoSuggestion extends CapoOption {
  sounds: string;
}

export const CAPO_NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const CAPO_SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const CAPO_FRIENDLY_SHAPES: readonly CapoShape[] = [
  { semitone: 0, major: "C", minor: "Am" },
  { semitone: 2, major: "D", minor: "Bm" },
  { semitone: 4, major: "E", minor: "C#m" },
  { semitone: 5, major: "F", minor: "Dm" },
  { semitone: 7, major: "G", minor: "Em" },
  { semitone: 9, major: "A", minor: "F#m" },
];
export const MAX_CAPO_FRET = 7;

export function keyToCapoSemitone(key: string): number | null {
  const cleaned = key.replace(/m$/, "");
  for (let index = 0; index < CAPO_NOTE_NAMES.length; index += 1) {
    if (CAPO_NOTE_NAMES[index] === cleaned || CAPO_SHARP_NAMES[index] === cleaned) {
      return index;
    }
  }
  return null;
}

export function capoOptions(key: string): CapoOption[] {
  const isMinor = key.endsWith("m");
  const tonic = keyToCapoSemitone(key);
  if (tonic === null) return [];

  const rows: CapoOption[] = [];
  for (const shape of CAPO_FRIENDLY_SHAPES) {
    const fret = (tonic - shape.semitone + 12) % 12;
    if (fret > MAX_CAPO_FRET) continue;
    rows.push({ fret, shape: isMinor ? shape.minor : shape.major });
  }
  rows.sort((a, b) => a.fret - b.fret);
  return rows;
}

export function suggestCapo(key: string): CapoSuggestion | null {
  const [best] = capoOptions(key);
  if (best === undefined) return null;
  return { ...best, sounds: key };
}

export function formatCapoSuggestion(key: string): string | null {
  const best = suggestCapo(key);
  if (best === null) return null;
  if (best.fret === 0) {
    return `To sound in ${key}, play ${best.shape} shapes with no capo.`;
  }
  return `To sound in ${key}, capo ${best.fret} and play ${best.shape} shapes.`;
}
