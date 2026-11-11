import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireElement, requireSelector } from "./dom";
import { createPasteControls, type PasteControls } from "./paste-controls";

interface Harness {
  controls: PasteControls;
  onChange: ReturnType<typeof vi.fn>;
  onFormatChange: ReturnType<typeof vi.fn>;
  el(id: string): HTMLElement;
}

function harness(maxSemitones = 11): Harness {
  document.body.innerHTML = `
    <button id="mode-key"></button>
    <button id="mode-semitone"></button>
    <button id="mode-nashville"></button>
    <div id="controls-key"></div>
    <div id="controls-semitone" class="hidden"></div>
    <div id="text_target_wrap"></div>
    <button id="text_swap"></button>
    <div id="text_key_distance_wrap"></div>
    <label for="text_current_key_trigger">Current key</label>
    <div id="chordpro-format-toggle" class="hidden"></div>
    <button id="format_chordpro"></button>
    <button id="format_plain"></button>
    <span id="semitone_value"></span>
    <button id="semitone_down"></button>
    <button id="semitone_up"></button>
    <button class="semitone-quick" data-semitone="2"></button>
    <button class="semitone-quick" data-semitone="-2"></button>
    <button id="notation_sharp"></button>
    <button id="notation_flat"></button>`;

  const onChange = vi.fn();
  const onFormatChange = vi.fn();
  const controls = createPasteControls({
    elements: {
      modeKey: requireElement("mode-key"),
      modeSemitone: requireElement("mode-semitone"),
      modeNashville: requireElement("mode-nashville"),
      controlsKey: requireElement("controls-key"),
      controlsSemitone: requireElement("controls-semitone"),
      targetWrap: requireElement("text_target_wrap"),
      swap: requireElement("text_swap"),
      keyDistanceWrap: requireElement("text_key_distance_wrap"),
      currentKeyLabel: requireSelector<HTMLLabelElement>('label[for="text_current_key_trigger"]'),
      formatToggle: requireElement("chordpro-format-toggle"),
      formatChordpro: requireElement("format_chordpro"),
      formatPlain: requireElement("format_plain"),
      semitoneValue: requireElement("semitone_value"),
      semitoneDown: requireElement("semitone_down"),
      semitoneUp: requireElement("semitone_up"),
      semitoneQuick: [...document.querySelectorAll<HTMLElement>(".semitone-quick")],
      notationSharp: requireElement("notation_sharp"),
      notationFlat: requireElement("notation_flat"),
    },
    maxSemitones,
    onChange,
    onFormatChange,
  });

  return { controls, onChange, onFormatChange, el: (id) => requireElement(id) };
}

let h: Harness;

beforeEach(() => {
  h = harness();
});

describe("defaults", () => {
  it("starts in key mode with no shift and sharp spelling", () => {
    expect(h.controls.mode()).toBe("key");
    expect(h.controls.semitones()).toBe(0);
    expect(h.controls.useFlats()).toBe(false);
    expect(h.controls.outputFormat()).toBe("chordpro");
  });
});

describe("mode switching", () => {
  it("shows the semitone controls and hides the key ones", () => {
    h.controls.selectMode("semitone");
    expect(h.el("controls-key").classList.contains("hidden")).toBe(true);
    expect(h.el("controls-semitone").classList.contains("hidden")).toBe(false);
    expect(h.el("mode-semitone").getAttribute("aria-selected")).toBe("true");
    expect(h.onChange).toHaveBeenCalled();
  });

  it("hides the target key and relabels the current key for nashville", () => {
    h.controls.selectMode("nashville");
    expect(h.el("text_target_wrap").classList.contains("hidden")).toBe(true);
    expect(h.el("text_swap").classList.contains("hidden")).toBe(true);
    expect(h.el("text_key_distance_wrap").classList.contains("hidden")).toBe(true);
    expect(requireSelector('label[for="text_current_key_trigger"]').textContent).toBe("Tonic key");
    expect(h.el("chordpro-format-toggle").classList.contains("hidden")).toBe(true);
  });

  it("restores the key controls when switching back", () => {
    h.controls.selectMode("nashville");
    h.controls.selectMode("key");
    expect(h.el("text_target_wrap").classList.contains("hidden")).toBe(false);
    expect(requireSelector('label[for="text_current_key_trigger"]').textContent).toBe(
      "Current key"
    );
  });

  it("responds to the mode buttons", () => {
    h.el("mode-nashville").click();
    expect(h.controls.mode()).toBe("nashville");
    h.el("mode-key").click();
    expect(h.controls.mode()).toBe("key");
  });
});

describe("semitone shifting", () => {
  it("steps up and down through the buttons", () => {
    h.el("semitone_up").click();
    expect(h.controls.semitones()).toBe(1);
    expect(h.el("semitone_value").textContent).toBe("+1");

    h.el("semitone_down").click();
    h.el("semitone_down").click();
    expect(h.controls.semitones()).toBe(-1);
    expect(h.el("semitone_value").textContent).toBe("−1");
  });

  it("clamps to the configured range", () => {
    h.controls.setSemitones(99);
    expect(h.controls.semitones()).toBe(11);
    h.controls.setSemitones(-99);
    expect(h.controls.semitones()).toBe(-11);
    expect(h.controls.clamp(50)).toBe(11);
  });

  it("marks the matching quick-pick chip", () => {
    h.controls.setSemitones(2);
    const chips = [...document.querySelectorAll<HTMLElement>(".semitone-quick")];
    expect(chips.map((chip) => chip.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
  });

  it("applies a quick-pick click", () => {
    document.querySelector<HTMLElement>('.semitone-quick[data-semitone="-2"]')!.click();
    expect(h.controls.semitones()).toBe(-2);
  });

  it("restores a saved shift without re-running the transposition", () => {
    h.onChange.mockClear();
    h.controls.applySavedSemitones(5);
    expect(h.controls.semitones()).toBe(5);
    expect(h.onChange).not.toHaveBeenCalled();

    h.controls.refreshSemitoneDisplay();
    expect(h.el("semitone_value").textContent).toBe("+5");
  });
});

describe("keyboard shortcuts", () => {
  function press(key: string, target: EventTarget = document.body): void {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
  }

  it("shifts with [ and ] in semitone mode", () => {
    h.controls.selectMode("semitone");
    press("]");
    expect(h.controls.semitones()).toBe(1);
    press("[");
    press("[");
    expect(h.controls.semitones()).toBe(-1);
  });

  it("ignores the shortcuts outside semitone mode", () => {
    press("]");
    expect(h.controls.semitones()).toBe(0);
  });

  it("ignores the shortcuts while typing", () => {
    h.controls.selectMode("semitone");
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    press("]", field);
    expect(h.controls.semitones()).toBe(0);
  });

  it("ignores other keys", () => {
    h.controls.selectMode("semitone");
    press("x");
    expect(h.controls.semitones()).toBe(0);
  });
});

describe("notation and output format", () => {
  it("toggles sharp and flat spelling", () => {
    h.el("notation_flat").click();
    expect(h.controls.useFlats()).toBe(true);
    expect(h.el("notation_flat").getAttribute("aria-pressed")).toBe("true");
    expect(h.el("notation_sharp").getAttribute("aria-pressed")).toBe("false");

    h.el("notation_sharp").click();
    expect(h.controls.useFlats()).toBe(false);
  });

  it("switches the output format without saving a preference", () => {
    h.onChange.mockClear();
    h.el("format_plain").click();
    expect(h.controls.outputFormat()).toBe("plain");
    expect(h.onFormatChange).toHaveBeenCalled();
    expect(h.onChange).not.toHaveBeenCalled();

    h.el("format_chordpro").click();
    expect(h.controls.outputFormat()).toBe("chordpro");
  });

  it("shows and hides the ChordPro format toggle", () => {
    h.controls.setFormatToggleVisible(true);
    expect(h.el("chordpro-format-toggle").classList.contains("hidden")).toBe(false);
    h.controls.setFormatToggleVisible(false);
    expect(h.el("chordpro-format-toggle").classList.contains("hidden")).toBe(true);
  });
});
