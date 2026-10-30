import { chordRoot, type Change } from "./transpose/chords";

export interface ChangeGroup {
  from: string;
  to: string;
  members: string[];
}

export function groupChanges(changes: readonly Change[]): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();
  for (const [original, transposed] of changes) {
    const from = chordRoot(original);
    const to = chordRoot(transposed);
    const key = `${from}\u0000${to}`;
    const group = groups.get(key) ?? { from, to, members: [] };
    group.members.push(original);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function renderChangeRow(group: ChangeGroup): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "py-1.5 font-mono text-slate-700 dark:text-slate-200";
  const label = document.createElement("span");
  label.className = "font-medium";
  label.textContent = `${group.from} → ${group.to}`;
  row.appendChild(label);
  const extras = group.members.filter((member) => member !== group.from);
  if (extras.length > 0) {
    const members = document.createElement("span");
    members.className = "text-muted-light dark:text-muted";
    members.textContent = ` · ${extras.join(" · ")}`;
    row.appendChild(members);
  }
  return row;
}
