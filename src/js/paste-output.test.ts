import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChangesDisclosure } from "./changes-disclosure";
import { requireElement } from "./dom";
import { createPasteOutput, type PasteOutput } from "./paste-output";

interface Harness {
  output: PasteOutput;
  pane: HTMLElement;
  status: HTMLElement;
  copy: HTMLButtonElement;
  stage: HTMLButtonElement;
  capo: HTMLElement;
  changes: ChangesDisclosure;
  renderInto: ReturnType<typeof vi.fn>;
  state: { capoApplies: boolean; targetKey: string };
}

function harness(): Harness {
  document.body.innerHTML = `
    <pre id="pane"></pre>
    <span id="status"></span>
    <button id="copy" disabled></button>
    <button id="stage" disabled></button>
    <p id="capo" class="hidden"></p>`;
  const pane = requireElement("pane");
  const status = requireElement("status");
  const copy = requireElement<HTMLButtonElement>("copy");
  const stage = requireElement<HTMLButtonElement>("stage");
  const capo = requireElement("capo");
  const changes: ChangesDisclosure = { show: vi.fn(), hide: vi.fn() };
  const renderInto = vi.fn((target: HTMLElement, text: string) => {
    target.textContent = text;
  });
  const state = { capoApplies: true, targetKey: "D" };

  const output = createPasteOutput({
    elements: { output: pane, status, copy, stage, capoSuggestion: capo },
    changes,
    renderInto,
    capoApplies: () => state.capoApplies,
    targetKey: () => state.targetKey,
  });

  return { output, pane, status, copy, stage, capo, changes, renderInto, state };
}

let h: Harness;

beforeEach(() => {
  h = harness();
});

describe("render", () => {
  it("renders through the diagram renderer and enables copy", () => {
    h.output.render("D A Bm G", true);
    expect(h.renderInto).toHaveBeenCalledWith(h.pane, "D A Bm G");
    expect(h.pane.textContent).toBe("D A Bm G");
    expect(h.copy.disabled).toBe(false);
    expect(h.output.text()).toBe("D A Bm G");
    expect(h.pane.hasAttribute("data-unchanged")).toBe(false);
  });

  it("marks an untransposed sheet", () => {
    h.output.render("C G", false);
    expect(h.pane.hasAttribute("data-unchanged")).toBe(true);
  });

  it("keeps copy disabled for empty output", () => {
    h.output.render("", true);
    expect(h.copy.disabled).toBe(true);
    expect(h.output.hasOutput()).toBe(false);
  });
});

describe("clear", () => {
  it("empties the pane and disables copy", () => {
    h.output.render("D A", true);
    h.output.clear();
    expect(h.pane.textContent).toBe("");
    expect(h.copy.disabled).toBe(true);
    expect(h.output.text()).toBe("");
  });
});

describe("hasOutput", () => {
  it("treats whitespace-only output as empty", () => {
    h.output.render("   \n  ", true);
    expect(h.output.hasOutput()).toBe(false);
  });
});

describe("status and changes", () => {
  it("writes the status line", () => {
    h.output.setStatus("C → D · 2 chords changed");
    expect(h.status.textContent).toBe("C → D · 2 chords changed");
  });

  it("renders one pill per change", () => {
    h.output.showChanges([
      { from: "C", to: "D" },
      { from: "G", to: "A" },
    ]);
    const rows = (h.changes.show as unknown as { mock: { calls: Node[][][] } }).mock.calls[0]![0]!;
    expect(rows.map((node) => node.textContent)).toEqual(["C → D", "G → A"]);
  });

  it("hides the disclosure when there is nothing to show", () => {
    h.output.showChanges([]);
    expect(h.changes.hide).toHaveBeenCalled();
    expect(h.changes.show).not.toHaveBeenCalled();
  });

  it("hides the disclosure on request", () => {
    h.output.hideChanges();
    expect(h.changes.hide).toHaveBeenCalled();
  });
});

describe("capo suggestion", () => {
  it("shows a suggestion when the mode and instrument allow it", () => {
    h.output.render("D A Bm G", true);
    h.output.updateCapo();
    expect(h.capo.classList.contains("hidden")).toBe(false);
    expect(h.capo.textContent).not.toBe("");
  });

  it("stays hidden when there is no output", () => {
    h.output.updateCapo();
    expect(h.capo.classList.contains("hidden")).toBe(true);
    expect(h.capo.textContent).toBe("");
  });

  it("stays hidden when capo does not apply", () => {
    h.output.render("D A Bm G", true);
    h.state.capoApplies = false;
    h.output.updateCapo();
    expect(h.capo.classList.contains("hidden")).toBe(true);
  });

  it("stays hidden for a key the capo tables do not know", () => {
    h.output.render("H Fis", true);
    h.state.targetKey = "H";
    h.output.updateCapo();
    expect(h.capo.classList.contains("hidden")).toBe(true);
    expect(h.capo.textContent).toBe("");
  });
});

describe("syncControls", () => {
  it("enables the stage button once there is output", () => {
    h.output.syncControls();
    expect(h.stage.disabled).toBe(true);

    h.output.render("D A Bm G", true);
    h.output.syncControls();
    expect(h.stage.disabled).toBe(false);
  });
});
