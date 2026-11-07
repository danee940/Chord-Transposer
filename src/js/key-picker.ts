import { pluralise } from "./dom";
import { keySemitone, mod12, parseKey } from "./transpose/notation";

interface KeyNames {
  english: string;
  german: string;
}

// One column per pitch class, holding its enharmonic spellings.
const MAJOR_COLUMNS: readonly (readonly KeyNames[])[] = [
  [{ english: "C", german: "C" }],
  [
    { english: "C#", german: "Cis" },
    { english: "Db", german: "Des" },
  ],
  [{ english: "D", german: "D" }],
  [
    { english: "D#", german: "Dis" },
    { english: "Eb", german: "Es" },
  ],
  [{ english: "E", german: "E" }],
  [{ english: "F", german: "F" }],
  [
    { english: "F#", german: "Fis" },
    { english: "Gb", german: "Ges" },
  ],
  [{ english: "G", german: "G" }],
  [
    { english: "G#", german: "Gis" },
    { english: "Ab", german: "As" },
  ],
  [{ english: "A", german: "A" }],
  [
    { english: "A#", german: "Ais" },
    { english: "Bb", german: "B" },
  ],
  [{ english: "B", german: "H" }],
];

const SPELLING_WITHOUT_MINOR_KEY = "Gb";

const MINOR_COLUMNS: readonly (readonly KeyNames[])[] = MAJOR_COLUMNS.map((column) =>
  column
    .filter((names) => names.english !== SPELLING_WITHOUT_MINOR_KEY)
    .map((names) => ({ english: `${names.english}m`, german: `${names.german}m` }))
);

const ALL_KEYS = [...MAJOR_COLUMNS.flat(), ...MINOR_COLUMNS.flat()];
const TO_GERMAN = new Map(ALL_KEYS.map((names) => [names.english, names.german]));
const TO_ENGLISH = new Map(ALL_KEYS.map((names) => [names.german, names.english]));

function keyName(names: KeyNames, german: boolean): string {
  return german ? names.german : names.english;
}

export function translateKey(value: string, german: boolean): string {
  return (german ? TO_GERMAN : TO_ENGLISH).get(value) ?? value;
}

const WHITE_PITCH_CLASSES: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

const INTERVAL_NAMES: Readonly<Record<number, string>> = {
  1: "a half step",
  2: "a whole step",
  3: "a minor third",
  4: "a major third",
  5: "a fourth",
  6: "a tritone",
};

const NOTATION_CHOICES: readonly (readonly [label: string, german: boolean])[] = [
  ["A–B", false],
  ["A–H", true],
];

export function displayKey(value: string): string {
  return value.charAt(0) + value.slice(1).replace("#", "♯").replace("b", "♭");
}

interface KeyShift {
  semitones: number;
  sameKey: boolean;
}

function shortestShift(
  currentValue: string,
  targetValue: string,
  german: boolean
): KeyShift | null {
  const current = parseKey(currentValue);
  const target = parseKey(targetValue);
  if (current === null || target === null) return null;
  const upward = mod12(keySemitone(target.note, german) - keySemitone(current.note, german));
  return {
    semitones: upward <= 6 ? upward : upward - 12,
    sameKey: upward === 0 && current.minor === target.minor,
  };
}

export function semitoneDistance(
  currentValue: string,
  targetValue: string,
  german: boolean
): string | null {
  const shift = shortestShift(currentValue, targetValue, german);
  if (shift === null) return null;
  if (shift.sameKey) return "Same key";
  const sign = shift.semitones < 0 ? "−" : "+";
  return `${sign}${pluralise(Math.abs(shift.semitones), "semitone")}`;
}

export function intervalName(
  currentValue: string,
  targetValue: string,
  german: boolean
): string | null {
  const shift = shortestShift(currentValue, targetValue, german);
  if (shift === null) return null;
  const name = INTERVAL_NAMES[Math.abs(shift.semitones)];
  if (name === undefined) return null;
  return `${name} ${shift.semitones < 0 ? "down" : "up"}`;
}

export function keyboardColumn(pitchClass: number): number {
  const whiteIndex = WHITE_PITCH_CLASSES.indexOf(pitchClass);
  if (whiteIndex !== -1) return whiteIndex * 2 + 1;
  return WHITE_PITCH_CLASSES.indexOf(pitchClass - 1) * 2 + 2;
}

export interface KeyPickerField {
  trigger: HTMLButtonElement;
  label: HTMLElement;
  select: HTMLSelectElement;
  title: string;
}

export interface KeyPickerOptions {
  panel: HTMLElement;
  title: HTMLElement;
  distance: HTMLElement;
  interval: HTMLElement;
  fields: readonly [KeyPickerField, KeyPickerField];
  onNotationPick?: (german: boolean) => void;
  savedNotation?: boolean | undefined;
}

export interface KeyPicker {
  refresh(): void;
  setNotation(german: boolean): void;
  notationOverride(): boolean | undefined;
}

export function initKeyPicker({
  panel,
  title,
  distance,
  interval,
  fields,
  onNotationPick,
  savedNotation,
}: KeyPickerOptions): KeyPicker {
  let active: KeyPickerField | null = null;
  let german = savedNotation ?? false;
  let overridden = savedNotation !== undefined;
  let buttons: HTMLButtonElement[] = [];
  const notationButtons: HTMLButtonElement[] = [];

  function keyButton(names: KeyNames): HTMLButtonElement {
    const value = keyName(names, german);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key-button";
    button.dataset["key"] = value;
    button.setAttribute("aria-pressed", "false");
    button.textContent = displayKey(value);
    button.addEventListener("click", () => pick(value));
    buttons.push(button);
    return button;
  }

  function buildSection(label: string, columns: readonly (readonly KeyNames[])[]): HTMLElement {
    const section = document.createElement("div");
    const heading = document.createElement("div");
    heading.className = "mb-1.5 text-xs font-medium text-graphite";
    heading.textContent = label;
    const keyboard = document.createElement("div");
    keyboard.className = "keyboard";
    columns.forEach((spellings, pitchClass) => {
      const key = document.createElement("div");
      key.className = WHITE_PITCH_CLASSES.includes(pitchClass)
        ? "keyboard-white"
        : "keyboard-black";
      key.style.gridColumn = `${keyboardColumn(pitchClass)} / span 2`;
      for (const names of spellings) {
        key.appendChild(keyButton(names));
      }
      keyboard.appendChild(key);
    });
    section.append(heading, keyboard);
    return section;
  }

  const header = document.createElement("div");
  header.className = "mb-3 flex items-center justify-between gap-2";
  title.replaceWith(header);
  header.appendChild(title);

  const notationSwitch = document.createElement("div");
  notationSwitch.className = "flex items-center gap-0.5";
  notationSwitch.title = "Note names: A–B is English, A–H is German (H is B, B is B flat)";
  for (const [label, value] of NOTATION_CHOICES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key-names-option";
    button.dataset["notation"] = value ? "german" : "english";
    button.textContent = label;
    button.addEventListener("click", () => pickNotation(value));
    notationButtons.push(button);
    notationSwitch.appendChild(button);
  }
  header.appendChild(notationSwitch);

  const sections = document.createElement("div");
  sections.className = "space-y-4";
  panel.appendChild(sections);

  function buildGrid(): void {
    buttons = [];
    sections.replaceChildren(
      buildSection("Major", MAJOR_COLUMNS),
      buildSection("Minor", MINOR_COLUMNS)
    );
  }

  function hasOption(select: HTMLSelectElement, value: string): boolean {
    return [...select.options].some((option) => option.value === value);
  }

  function markNotation(): void {
    for (const button of notationButtons) {
      const isActive = (button.dataset["notation"] === "german") === german;
      button.setAttribute("aria-pressed", String(isActive));
    }
  }

  function applyNotation(next: boolean): void {
    if (next === german) return;
    german = next;
    for (const field of fields) {
      const translated = translateKey(field.select.value, german);
      if (hasOption(field.select, translated)) field.select.value = translated;
    }
    buildGrid();
    refresh();
  }

  function setNotation(next: boolean): void {
    if (overridden) return;
    applyNotation(next);
  }

  function pickNotation(next: boolean): void {
    overridden = true;
    applyNotation(next);
    markNotation();
    if (onNotationPick) onNotationPick(next);
  }

  function markSelected(): void {
    const selected = active?.select.value;
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset["key"] === selected));
    }
  }

  function refresh(): void {
    for (const field of fields) {
      field.label.textContent = displayKey(field.select.value);
    }
    const [current, target] = [fields[0].select.value, fields[1].select.value];
    const text = semitoneDistance(current, target, german);
    distance.textContent = text ?? "";
    distance.classList.toggle("hidden", text === null);
    interval.textContent = intervalName(current, target, german) ?? "";
    markSelected();
    markNotation();
  }

  function close(): void {
    active = null;
    panel.classList.add("hidden");
    for (const field of fields) {
      field.trigger.setAttribute("aria-expanded", "false");
    }
  }

  function open(field: KeyPickerField): void {
    active = field;
    title.textContent = field.title;
    panel.classList.remove("hidden");
    for (const other of fields) {
      other.trigger.setAttribute("aria-expanded", String(other === field));
    }
    markSelected();
  }

  function pick(value: string): void {
    if (active === null) return;
    const { select, trigger } = active;
    select.value = value;
    select.dispatchEvent(new Event("change"));
    close();
    trigger.focus();
  }

  for (const field of fields) {
    field.trigger.addEventListener("click", () => {
      if (active === field) {
        close();
      } else {
        open(field);
      }
    });
    field.select.addEventListener("change", refresh);
  }

  document.addEventListener("click", (event) => {
    if (active === null) return;
    const path = event.composedPath();
    if (path.includes(panel)) return;
    if (fields.some((field) => path.includes(field.trigger))) return;
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active !== null) close();
  });

  buildGrid();
  refresh();
  return {
    refresh,
    setNotation,
    notationOverride: () => (overridden ? german : undefined),
  };
}
