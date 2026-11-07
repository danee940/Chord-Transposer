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
    table.className = "data-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.className = "text-left";
    headRow.appendChild(makeHeaderCell("Capo fret", ""));
    headRow.appendChild(makeHeaderCell("Play shape", ""));
    headRow.appendChild(makeHeaderCell("Sounds like", ""));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.appendChild(makeCell(row.fret === 0 ? "No capo" : String(row.fret), "tabular-nums"));
      tr.appendChild(makeCell(row.shape, "font-mono font-semibold"));
      tr.appendChild(makeCell(key, "font-mono"));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    capoTableOutput.appendChild(table);
  }

  capoKey.addEventListener("change", renderCapoTable);
  renderCapoTable();
}
