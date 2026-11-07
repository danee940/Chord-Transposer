export const MAX_BINDER_FILES = 20;
export const MAX_BINDER_TOTAL_BYTES = 40 * 1024 * 1024;

const BYTES_PER_MB = 1024 * 1024;

export interface BinderEntry {
  file: File;
  problem: string | null;
}

export type ProblemLookup = (file: File) => string | null;

export interface BinderCheck {
  entries: BinderEntry[];
  summary: string | null;
}

export type FileAction = "up" | "down" | "remove";

const FOCUS_ORDER: Readonly<Record<FileAction, readonly FileAction[]>> = {
  up: ["up", "down", "remove"],
  down: ["down", "up", "remove"],
  remove: ["remove"],
};

export interface FileListActions {
  move(index: number, offset: -1 | 1): void;
  remove(index: number): void;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / BYTES_PER_MB;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function binderFileProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".docx")) return "Only .docx files can go in a binder.";
  if (file.size === 0) return "This file is empty.";
  return null;
}

export function flaggedSummary(count: number): string {
  return count === 1
    ? "Remove the highlighted file to build the binder."
    : `Remove the ${count} highlighted files to build the binder.`;
}

function selectionProblem(entries: readonly BinderEntry[]): string | null {
  const flagged = entries.filter((entry) => entry.problem !== null).length;
  const total = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  if (entries.length > MAX_BINDER_FILES)
    return `Too many files. The maximum is ${MAX_BINDER_FILES}.`;
  if (flagged > 0) return flaggedSummary(flagged);
  if (total > MAX_BINDER_TOTAL_BYTES)
    return `Files are too large. The combined maximum is ${MAX_BINDER_TOTAL_BYTES / BYTES_PER_MB} MB.`;
  return null;
}

export function fileKey(file: File): string {
  return [file.name, file.size, file.lastModified].join("\u0000");
}

export function checkBinder(
  files: readonly File[],
  knownProblem: ProblemLookup = () => null
): BinderCheck {
  const entries = files.map((file) => ({
    file,
    problem: binderFileProblem(file) ?? knownProblem(file),
  }));
  return { entries, summary: selectionProblem(entries) };
}

export function moveItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  const moved = [...items];
  if (target < 0 || target >= items.length) return moved;
  moved.splice(target, 0, ...moved.splice(index, 1));
  return moved;
}

const ARROW_UP = '<path d="M6 9.5v-7m0 0L3 5.5m3-3 3 3" />';
const ARROW_DOWN = '<path d="M6 2.5v7m0 0L3 6.5m3 3 3-3" />';
const CROSS = '<path d="M3 3l6 6M9 3 3 9" />';

function iconButton(path: string, label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "file-action";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  button.addEventListener("click", onClick);
  return button;
}

function fileRow(
  { file, problem }: BinderEntry,
  index: number,
  count: number,
  actions: FileListActions
): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "file-row";
  row.dataset["file"] = file.name;
  if (problem !== null) row.dataset["invalid"] = "";

  const position = document.createElement("span");
  position.className = "file-position";
  position.textContent = String(index + 1);

  const details = document.createElement("div");
  details.className = "min-w-0 flex-1";
  const name = document.createElement("p");
  name.className = "file-name";
  name.textContent = file.name;
  const meta = document.createElement("p");
  meta.className = "file-meta";
  meta.textContent = problem ?? formatBytes(file.size);
  details.append(name, meta);

  const up = iconButton(ARROW_UP, `Move ${file.name} up`, () => actions.move(index, -1));
  up.disabled = index === 0;
  up.dataset["action"] = "up";
  const down = iconButton(ARROW_DOWN, `Move ${file.name} down`, () => actions.move(index, 1));
  down.disabled = index === count - 1;
  down.dataset["action"] = "down";
  const remove = iconButton(CROSS, `Remove ${file.name}`, () => actions.remove(index));
  remove.dataset["action"] = "remove";

  row.append(position, details, up, down, remove);
  return row;
}

export function renderFileList(
  list: HTMLElement,
  entries: readonly BinderEntry[],
  actions: FileListActions
): void {
  list.replaceChildren(
    ...entries.map((entry, index) => fileRow(entry, index, entries.length, actions))
  );
  list.classList.toggle("hidden", entries.length < 2);
}

export function focusFileAction(list: HTMLElement, index: number, action: FileAction): void {
  const row = list.children.item(Math.min(index, list.children.length - 1));
  const target = FOCUS_ORDER[action]
    .map((candidate) =>
      row?.querySelector<HTMLButtonElement>(`button[data-action="${candidate}"]:enabled`)
    )
    .find((button) => button !== null && button !== undefined);
  target?.focus();
}
