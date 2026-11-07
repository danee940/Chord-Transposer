export const NOTICE_CLASSES = "notice mt-4";
export const NOTICE_ERROR_CLASSES = "notice-error";
export const NOTICE_OK_CLASSES = "notice-ok";

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

export function pluralise(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
