const PREFS_STORAGE_KEY = "chord-transposer:prefs";
const STRING_PREF_KEYS = ["mode", "currentKey", "targetKey", "notation", "instrument"] as const;

export interface Prefs {
  mode?: string;
  currentKey?: string;
  targetKey?: string;
  semitones?: number;
  notation?: string;
  instrument?: string;
}

export function sanitizePrefs(raw: unknown): Prefs {
  const clean: Prefs = {};
  if (typeof raw !== "object" || raw === null) return clean;
  const source = raw as Record<string, unknown>;
  for (const key of STRING_PREF_KEYS) {
    const value = source[key];
    if (typeof value === "string") clean[key] = value;
  }
  if (typeof source.semitones === "number") clean.semitones = source.semitones;
  return clean;
}

export function loadPrefs(): Prefs {
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!stored) return {};
    return sanitizePrefs(JSON.parse(stored));
  } catch {
    return {};
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(sanitizePrefs(prefs)));
  } catch {
    return;
  }
}
