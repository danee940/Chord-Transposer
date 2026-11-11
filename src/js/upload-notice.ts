import { changePairs } from "./upload-download";
import {
  NOTICE_CLASSES,
  NOTICE_ERROR_CLASSES,
  NOTICE_OK_CLASSES,
  makeCell,
  makeHeaderCell,
} from "./dom";

export interface Notice {
  hide(): void;
  error(text: string): void;
  result(headingText: string, ...details: Node[]): void;
  transposeResult(from: string, to: string, changesRaw: string): void;
}

function renderChangeTable(changesRaw: string): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "w-full border-collapse";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.className = "text-left text-graphite";
  headRow.appendChild(makeHeaderCell("Before", "pb-1 pr-4 font-medium"));
  headRow.appendChild(makeHeaderCell("After", "pb-1 font-medium"));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const [original, transposed] of changePairs(changesRaw)) {
    const row = document.createElement("tr");
    row.className = "border-t border-rule";
    row.appendChild(makeCell(original, "py-1 pr-4 font-mono"));
    row.appendChild(makeCell(transposed, "py-1 font-mono"));
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  return table;
}

export function createNotice(message: HTMLElement): Notice {
  function result(headingText: string, ...details: Node[]): void {
    message.className = `${NOTICE_CLASSES} ${NOTICE_OK_CLASSES}`;
    const heading = document.createElement("div");
    heading.className = details.length > 0 ? "mb-2 font-semibold" : "font-semibold";
    heading.textContent = headingText;
    message.replaceChildren(heading, ...details);
  }

  return {
    hide(): void {
      message.className = "hidden";
      message.replaceChildren();
    },
    error(text: string): void {
      message.className = `${NOTICE_CLASSES} ${NOTICE_ERROR_CLASSES}`;
      message.textContent = text;
    },
    result,
    transposeResult(from: string, to: string, changesRaw: string): void {
      result(`Transposed from ${from} to ${to}`, renderChangeTable(changesRaw));
    },
  };
}
