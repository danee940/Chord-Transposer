import { capoOptions } from "./capo-suggest";
import { makeCell, makeHeaderCell, requireElement } from "./dom";

export function initCapo(): void {
  const capoKey = requireElement<HTMLSelectElement>("capo-key");
  const capoTableOutput = requireElement("capo-table-output");

  function renderCapoTable(): void {
    const key = capoKey.value;
    capoTableOutput.replaceChildren();
    const rows = capoOptions(key);
    if (rows.length === 0) return;

    const table = document.createElement("table");
    table.className = "w-full border-collapse";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.className = "text-left text-muted-light dark:text-muted";
    headRow.appendChild(makeHeaderCell("Capo fret", "pb-2 pr-4 font-medium"));
    headRow.appendChild(makeHeaderCell("Play shape", "pb-2 pr-4 font-medium"));
    headRow.appendChild(makeHeaderCell("Sounds like", "pb-2 font-medium"));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.className = "border-t border-app-border-light dark:border-app-border";
      tr.appendChild(makeCell(row.fret === 0 ? "No capo" : String(row.fret), "py-2 pr-4"));
      tr.appendChild(makeCell(row.shape, "py-2 pr-4 font-mono text-slate-900 dark:text-slate-100"));
      tr.appendChild(makeCell(key, "py-2 font-mono text-slate-900 dark:text-slate-100"));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    capoTableOutput.appendChild(table);
  }

  capoKey.addEventListener("change", renderCapoTable);
  renderCapoTable();
}
