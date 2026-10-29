import { beforeEach, describe, expect, it } from "vitest";

import { initCapo } from "./capo";

function setupDom() {
  document.body.innerHTML = `
    <select id="capo-key">
      <option value="C">C</option>
      <option value="G">G</option>
    </select>
    <div id="capo-table-output"></div>
  `;
}

describe("initCapo", () => {
  beforeEach(setupDom);

  it("renders a capo table for the initial key", () => {
    initCapo();
    const output = document.getElementById("capo-table-output");
    const rows = output.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    expect(output.querySelectorAll("thead th")).toHaveLength(3);
  });

  it("labels the zero fret as 'No capo'", () => {
    initCapo();
    const firstCell = document.querySelector("#capo-table-output tbody tr td");
    expect(firstCell.textContent).toBe("No capo");
  });

  it("re-renders when the key changes", () => {
    initCapo();
    const capoKey = document.getElementById("capo-key");
    capoKey.value = "G";
    capoKey.dispatchEvent(new Event("change"));
    const soundsLike = document.querySelectorAll("#capo-table-output tbody tr td:last-child");
    expect([...soundsLike].every((cell) => cell.textContent === "G")).toBe(true);
  });

  it("clears the output when there are no capo options", () => {
    const capoKey = document.getElementById("capo-key");
    const unknown = document.createElement("option");
    unknown.value = "??";
    capoKey.appendChild(unknown);
    capoKey.value = "??";
    initCapo();
    expect(document.getElementById("capo-table-output").children).toHaveLength(0);
  });
});
