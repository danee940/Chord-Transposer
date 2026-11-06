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

const KEY_BUTTON_CLASSES =
  "flex-1 rounded-lg border border-app-border-light bg-bg-light px-1 py-1.5 font-mono text-xs " +
  "font-medium text-slate-700 transition-colors hover:border-accent focus:outline-hidden " +
  "focus:ring-2 focus:ring-accent dark:border-app-border dark:bg-bg dark:text-slate-200";
const KEY_SELECTED_CLASSES = ["border-accent", "bg-accent/10", "text-accent", "dark:text-accent"];

const NOTATION_BUTTON_CLASSES =
  "rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide " +
  "text-muted-light transition-colors hover:text-slate-700 focus:outline-hidden " +
  "focus:ring-1 focus:ring-accent dark:text-muted dark:hover:text-slate-200";
const NOTATION_ACTIVE_CLASSES = ["bg-accent/10", "text-accent", "dark:text-accent"];

const NOTATION_CHOICES: readonly (readonly [label: string, german: boolean])[] = [
  ["A–B", false],
  ["A–H", true],
];

export function displayKey(value: string): string {
  return value.charAt(0) + value.slice(1).replace("#", "♯").replace("b", "♭");
}

export function semitoneDistance(
  currentValue: string,
  targetValue: string,
  german: boolean
): string | null {
  const current = parseKey(currentValue);
  const target = parseKey(targetValue);
  if (current === null || target === null) return null;
  const upward = mod12(keySemitone(target.note, german) - keySemitone(current.note, german));
  if (upward === 0 && current.minor === target.minor) return "Same key";
  const shortest = upward <= 6 ? upward : upward - 12;
  const sign = shortest < 0 ? "−" : "+";
  return `${sign}${pluralise(Math.abs(shortest), "semitone")}`;
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
    button.className = KEY_BUTTON_CLASSES;
    button.dataset["key"] = value;
    button.textContent = displayKey(value);
    button.addEventListener("click", () => pick(value));
    buttons.push(button);
    return button;
  }

  function buildSection(label: string, columns: readonly (readonly KeyNames[])[]): HTMLElement {
    const section = document.createElement("div");
    const heading = document.createElement("div");
    heading.className =
      "mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-light dark:text-muted";
    heading.textContent = label;
    section.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-6 gap-1 sm:grid-cols-12";
    for (const column of columns) {
      const cell = document.createElement("div");
      cell.className = "contents sm:flex sm:flex-col sm:gap-1";
      for (const names of column) {
        cell.appendChild(keyButton(names));
      }
      grid.appendChild(cell);
    }
    section.appendChild(grid);
    return section;
  }

  const header = document.createElement("div");
  header.className = "mb-2 flex items-center justify-between gap-2";
  title.classList.remove("mb-2");
  title.replaceWith(header);
  header.appendChild(title);

  const notationSwitch = document.createElement("div");
  notationSwitch.className = "flex items-center gap-0.5";
  notationSwitch.title = "Note names: A–B is English, A–H is German (H is B, B is B flat)";
  for (const [label, value] of NOTATION_CHOICES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = NOTATION_BUTTON_CLASSES;
    button.dataset["notation"] = value ? "german" : "english";
    button.textContent = label;
    button.addEventListener("click", () => pickNotation(value));
    notationButtons.push(button);
    notationSwitch.appendChild(button);
  }
  header.appendChild(notationSwitch);

  const sections = document.createElement("div");
  sections.className = "space-y-3";
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
      NOTATION_ACTIVE_CLASSES.forEach((cls) => button.classList.toggle(cls, isActive));
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
      const isSelected = button.dataset["key"] === selected;
      KEY_SELECTED_CLASSES.forEach((cls) => button.classList.toggle(cls, isSelected));
    }
  }

  function refresh(): void {
    for (const field of fields) {
      field.label.textContent = displayKey(field.select.value);
    }
    const text = semitoneDistance(fields[0].select.value, fields[1].select.value, german);
    distance.textContent = text ?? "";
    distance.classList.toggle("hidden", text === null);
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
