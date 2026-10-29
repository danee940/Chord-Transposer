const PREFS_STORAGE_KEY = "chord-transposer:prefs";
const ALLOWED_PREF_KEYS = [
  "mode",
  "currentKey",
  "targetKey",
  "semitones",
  "notation",
  "instrument",
] as const;

export type PrefKey = (typeof ALLOWED_PREF_KEYS)[number];
export type PrefValue = string | number | boolean;
export type Prefs = Partial<Record<PrefKey, PrefValue>>;

export function sanitizePrefs(raw: unknown): Prefs {
  const clean: Prefs = {};
  if (typeof raw !== "object" || raw === null) return clean;
  const source = raw as Record<string, unknown>;
  for (const key of ALLOWED_PREF_KEYS) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
  }
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
