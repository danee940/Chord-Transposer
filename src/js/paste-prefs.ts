import { savePrefs } from "./prefs";
import type { TransposeMode } from "./paste-result";

export interface PasteSnapshot {
  mode: TransposeMode;
  currentKey: string;
  targetKey: string;
  semitones: number;
  useFlats: boolean;
  keyNames: boolean | undefined;
  instrument: string;
}

export function savedKeyNames(stored: string | undefined): boolean | undefined {
  if (stored === "german") return true;
  if (stored === "english") return false;
  return undefined;
}

export function keyNamesPref(german: boolean | undefined): string | undefined {
  if (german === undefined) return undefined;
  return german ? "german" : "english";
}

export function persistPaste(snapshot: PasteSnapshot): void {
  savePrefs({
    mode: snapshot.mode,
    currentKey: snapshot.currentKey,
    targetKey: snapshot.targetKey,
    semitones: snapshot.semitones,
    notation: snapshot.useFlats ? "flat" : "sharp",
    keyNames: keyNamesPref(snapshot.keyNames),
    instrument: snapshot.instrument,
  });
}
