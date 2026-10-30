import { pluralise } from "./dom";
import { keySemitone, mod12, parseKey } from "./transpose/notation";

const MAJOR_COLUMNS: readonly (readonly string[])[] = [
  ["C"],
  ["C#", "Db"],
  ["D"],
  ["D#", "Eb"],
  ["E"],
  ["F"],
  ["F#", "Gb"],
  ["G"],
  ["G#", "Ab"],
  ["A"],
  ["A#", "Bb"],
  ["B"],
];
const MINOR_COLUMNS: readonly (readonly string[])[] = MAJOR_COLUMNS.map((column) =>
  column.map((key) => `${key}m`).filter((key) => key !== "Gbm")
);

const KEY_BUTTON_CLASSES =
  "flex-1 rounded-lg border border-app-border-light bg-bg-light px-1 py-1.5 font-mono text-xs " +
  "font-medium text-slate-700 transition-colors hover:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-accent dark:border-app-border dark:bg-bg dark:text-slate-200";
const KEY_SELECTED_CLASSES = ["border-accent", "bg-accent/10", "text-accent", "dark:text-accent"];

export function displayKey(value: string): string {
  return value.charAt(0) + value.slice(1).replace("#", "♯").replace("b", "♭");
}

export function semitoneDistance(currentValue: string, targetValue: string): string | null {
  const current = parseKey(currentValue);
  const target = parseKey(targetValue);
  if (current === null || target === null) return null;
  const upward = mod12(keySemitone(target.note, false) - keySemitone(current.note, false));
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
}

export interface KeyPicker {
  refresh(): void;
}

export function initKeyPicker({ panel, title, distance, fields }: KeyPickerOptions): KeyPicker {
  let active: KeyPickerField | null = null;
  const buttons: HTMLButtonElement[] = [];

  function keyButton(value: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = KEY_BUTTON_CLASSES;
    button.dataset["key"] = value;
    button.textContent = displayKey(value);
    button.addEventListener("click", () => pick(value));
    buttons.push(button);
    return button;
  }

  function buildSection(label: string, columns: readonly (readonly string[])[]): HTMLElement {
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
      for (const value of column) {
        cell.appendChild(keyButton(value));
      }
      grid.appendChild(cell);
    }
    section.appendChild(grid);
    return section;
  }

  const sections = document.createElement("div");
  sections.className = "space-y-3";
  sections.appendChild(buildSection("Major", MAJOR_COLUMNS));
  sections.appendChild(buildSection("Minor", MINOR_COLUMNS));
  panel.appendChild(sections);

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
    const text = semitoneDistance(fields[0].select.value, fields[1].select.value);
    distance.textContent = text ?? "";
    distance.classList.toggle("hidden", text === null);
    markSelected();
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

  refresh();
  return { refresh };
}
