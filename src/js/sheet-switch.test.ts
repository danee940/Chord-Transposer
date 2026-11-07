import { afterEach, describe, expect, it } from "vitest";

import { requireElement } from "./dom";
import { initSheetSwitches } from "./sheet-switch";

function setupDom(): void {
  document.body.innerHTML = `
    <div id="sheets" data-sheets="input">
      <button id="show-input" data-sheet-view="input" aria-pressed="true"></button>
      <button id="show-output" data-sheet-view="output" aria-pressed="false"></button>
      <button id="show-unknown" data-sheet-view="sideways" aria-pressed="false"></button>
    </div>
  `;
}

function click(id: string): void {
  requireElement(id).dispatchEvent(new Event("click"));
}

describe("initSheetSwitches", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the chosen sheet and marks its option pressed", () => {
    setupDom();
    initSheetSwitches();
    click("show-output");
    expect(requireElement("sheets").dataset["sheets"]).toBe("output");
    expect(requireElement("show-output").getAttribute("aria-pressed")).toBe("true");
    expect(requireElement("show-input").getAttribute("aria-pressed")).toBe("false");

    click("show-input");
    expect(requireElement("sheets").dataset["sheets"]).toBe("input");
    expect(requireElement("show-input").getAttribute("aria-pressed")).toBe("true");
  });

  it("ignores an option that names an unknown sheet", () => {
    setupDom();
    initSheetSwitches();
    click("show-unknown");
    expect(requireElement("sheets").dataset["sheets"]).toBe("input");
    expect(requireElement("show-unknown").getAttribute("aria-pressed")).toBe("false");
  });

  it("does nothing on a page without sheets", () => {
    expect(() => initSheetSwitches()).not.toThrow();
  });
});
