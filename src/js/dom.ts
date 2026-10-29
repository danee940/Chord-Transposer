export const BASE_CLASSES = "mt-4 rounded-xl px-3.5 py-3 text-sm motion-safe:animate-fade-up";
export const ERROR_CLASSES = "border border-app-error/30 bg-app-error/10 text-app-error";
export const OK_CLASSES = "border border-app-ok/30 bg-app-ok/10 text-app-ok";

export const ACTIVE_TAB_CLASSES = [
  "bg-card-light",
  "text-slate-900",
  "shadow-sm",
  "dark:bg-card",
  "dark:text-slate-100",
];
export const INACTIVE_TAB_CLASSES = ["text-muted-light", "dark:text-muted"];

export const MODE_ACTIVE_CLASSES = [
  "bg-card-light",
  "text-slate-900",
  "shadow-sm",
  "dark:bg-card",
  "dark:text-slate-100",
];
export const MODE_INACTIVE_CLASSES = ["text-muted-light", "dark:text-muted"];

function required<T>(found: T | null, description: string): T {
  if (found === null) throw new Error(`Missing required element: ${description}`);
  return found;
}

export function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  return required(document.getElementById(id) as T | null, `#${id}`);
}

export function requireSelector<T extends Element = Element>(selector: string): T {
  return required(document.querySelector<T>(selector), selector);
}

export function makeCell(text: string, className: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

export function makeHeaderCell(text: string, className: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.className = className;
  cell.textContent = text;
  return cell;
}
