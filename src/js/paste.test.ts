import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { requireElement } from "./dom";
import { initPaste } from "./paste";
import type { Prefs } from "./prefs";

interface PanelAttrs {
  maxSemitones?: string;
  preselectFrom?: string;
  preselectTo?: string;
  dataInstrument?: string;
}

const PANEL_ATTRS: PanelAttrs = {
  maxSemitones: "11",
};

function buildDom(attrs: PanelAttrs = {}) {
  const merged = { ...PANEL_ATTRS, ...attrs };
  document.body.innerHTML = `
    <div id="panel-paste" data-max-semitones="${merged.maxSemitones}"
      ${merged.preselectFrom ? `data-preselect-from="${merged.preselectFrom}"` : ""}
      ${merged.preselectTo ? `data-preselect-to="${merged.preselectTo}"` : ""}
      ${merged.dataInstrument ? `data-instrument="${merged.dataInstrument}"` : ""}>
      <textarea id="text_input"></textarea>
      <div id="text_output"></div>
      <div id="text_status"></div>
      <button id="text_copy"></button>
      <select id="text_current_key"><option value="C">C</option><option value="D">D</option><option value="G">G</option></select>
      <div id="text_target_wrap">
        <select id="text_target_key"><option value="C">C</option><option value="D">D</option><option value="G">G</option></select>
      </div>
      <div><button id="text_swap"></button></div>
      <button id="text_current_key_trigger" type="button"><span id="text_current_key_label"></span></button>
      <button id="text_target_key_trigger" type="button"><span id="text_target_key_label"></span></button>
      <div id="text_key_picker" class="hidden"><div id="text_key_picker_title"></div></div>
      <p id="text_key_distance_wrap"><span id="text_key_distance"></span></p>
      <span id="text_linecount"></span>
      <button id="text_sample"></button>
      <button id="text_clear"></button>
      <button id="mode-key"></button>
      <button id="mode-semitone"></button>
      <button id="mode-nashville"></button>
      <div id="controls-key"></div>
      <div id="controls-semitone"></div>
      <label for="text_current_key_trigger"></label>
      <span id="text_detected_wrap" class="hidden">
        <span id="text_detected_label"></span>
        <button id="text_detected_alt" class="hidden"></button>
      </span>
      <div id="chordpro-format-toggle"></div>
      <button id="format_chordpro"></button>
      <button id="format_plain"></button>
      <span id="semitone_value"></span>
      <button id="semitone_down"></button>
      <button id="semitone_up"></button>
      <button class="semitone-quick" data-semitone="5"></button>
      <button id="notation_sharp"></button>
      <button id="notation_flat"></button>
      <select id="text_instrument"><option value="guitar">Guitar</option><option value="ukulele">Ukulele</option><option value="piano">Piano</option></select>
      <button id="text_stage"></button>
      <div id="capo-suggestion" class="hidden"></div>
      <div id="text_changes_wrap" class="hidden">
        <button id="text_changes_toggle" aria-expanded="false">
          <svg id="text_changes_caret"></svg>
          <span id="text_changes_label"></span>
        </button>
        <div id="text_changes" class="hidden"></div>
      </div>
    </div>
  `;
}

function type(text: string) {
  const input = requireElement<HTMLTextAreaElement>("text_input");
  input.value = text;
  input.dispatchEvent(new Event("input"));
}

describe("initPaste", () => {
  beforeEach(() => {
    buildDom();
    vi.useFakeTimers();
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  function output() {
    return requireElement("text_output");
  }
  function status() {
    return requireElement("text_status").textContent;
  }

  it("clears output for empty input", () => {
    initPaste();
    type("   ");
    vi.advanceTimersByTime(300);
    expect(output().textContent).toBe("");
    expect(requireElement<HTMLButtonElement>("text_copy").disabled).toBe(true);
  });

  it("transposes plain chord text between keys", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(output().textContent).toContain("D");
    expect(status()).toContain("C → D");
  });

  function changes() {
    return requireElement("text_changes");
  }
  function changesWrap() {
    return requireElement("text_changes_wrap");
  }
  function changesToggle() {
    return requireElement<HTMLButtonElement>("text_changes_toggle");
  }

  it("lists de-duplicated from→to chord mappings by key", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F\nC G");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    const pills = [...changes().querySelectorAll("span")].map((p) => p.textContent);
    expect(pills).toContain("C → D");
    expect(pills.filter((p) => p === "C → D")).toHaveLength(1);
  });

  it("keeps the pill list collapsed until the toggle is clicked", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changes().classList.contains("hidden")).toBe(true);
    expect(changesToggle().getAttribute("aria-expanded")).toBe("false");
    expect(requireElement("text_changes_label").textContent).toContain("Show");
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().classList.contains("hidden")).toBe(false);
    expect(changesToggle().getAttribute("aria-expanded")).toBe("true");
    expect(requireElement("text_changes_label").textContent).toContain("Hide");
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().classList.contains("hidden")).toBe(true);
    expect(requireElement("text_changes_label").textContent).toContain("Show");
  });

  it("resets the pill list to collapsed on a new transpose", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().classList.contains("hidden")).toBe(false);
    type("C G Am F Em");
    vi.advanceTimersByTime(300);
    expect(changes().classList.contains("hidden")).toBe(true);
    expect(changesToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("lists chord mappings in semitone mode", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    requireElement<HTMLButtonElement>("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().querySelectorAll("span").length).toBeGreaterThan(0);
  });

  it("hides the change list when no chords change", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("just lyrics with no chords");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
    expect(changes().querySelectorAll("span").length).toBe(0);
  });

  it("hides the change list in nashville mode", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLButtonElement>("mode-nashville").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list when input is cleared", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    type("   ");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list when the two keys are identical", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    requireElement<HTMLSelectElement>("text_target_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").dispatchEvent(new Event("change"));
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list at zero semitones", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list when an invalid key is used", () => {
    initPaste();
    const currentKey = requireElement<HTMLSelectElement>("text_current_key");
    const bad = document.createElement("option");
    bad.value = "??";
    currentKey.appendChild(bad);
    currentKey.value = "??";
    currentKey.dispatchEvent(new Event("change"));
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("warns when the two keys are identical", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "C";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("different keys");
  });

  it("updates the line count", () => {
    initPaste();
    type("line one\nline two");
    expect(requireElement("text_linecount").textContent).toBe("2 lines");
    type("only one");
    expect(requireElement("text_linecount").textContent).toBe("1 line");
  });

  it("switches to semitone mode and shifts", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    requireElement<HTMLButtonElement>("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(requireElement("semitone_value").textContent).toBe("+1");
    expect(status()).toContain("semitone");
  });

  it("labels a single downward semitone with a flat accidental", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    requireElement<HTMLButtonElement>("notation_flat").dispatchEvent(new Event("click"));
    type("C G Am F");
    requireElement<HTMLButtonElement>("semitone_down").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(status()).toContain("−1 semitone (♭)");
  });

  it("labels multiple upward semitones with a sharp accidental", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    document.querySelector(".semitone-quick")!.dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(status()).toContain("+5 semitones (♯)");
  });

  it("shifts chordpro text by semitones", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("[C]Twinkle [G]twinkle");
    requireElement<HTMLButtonElement>("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(output().textContent).toContain("[");
    expect(status()).toContain("semitone");
  });

  it("reports when no chords are found to change", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("just some lyrics with no chords");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("no chords found");
  });

  it("reports a single changed chord in the singular", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("C\nlyrics here");
    requireElement<HTMLButtonElement>("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(status()).toContain("1 chord changed");
  });

  it("shows the no-shift hint at zero semitones", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("No shift");
  });

  it("decrements and clamps semitones", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    requireElement<HTMLButtonElement>("semitone_down").dispatchEvent(new Event("click"));
    expect(requireElement("semitone_value").textContent).toBe("-1");
  });

  it("applies a quick semitone preset", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    document.querySelector(".semitone-quick")!.dispatchEvent(new Event("click"));
    expect(requireElement("semitone_value").textContent).toBe("+5");
  });

  it("responds to [ and ] keyboard shortcuts in semitone mode", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(requireElement("semitone_value").textContent).toBe("+1");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "[" }));
    expect(requireElement("semitone_value").textContent).toBe("0");
  });

  it("ignores keyboard shortcuts outside semitone mode", () => {
    initPaste();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(requireElement("semitone_value").textContent).toBe("0");
  });

  it("ignores keyboard shortcuts while typing in a field", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    const event = new KeyboardEvent("keydown", { key: "]" });
    Object.defineProperty(event, "target", {
      value: requireElement<HTMLTextAreaElement>("text_input"),
    });
    document.dispatchEvent(event);
    expect(requireElement("semitone_value").textContent).toBe("0");
  });

  it("switches to nashville mode", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLButtonElement>("mode-nashville").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("Nashville");
  });

  it("toggles notation between sharp and flat", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-semitone").dispatchEvent(new Event("click"));
    requireElement<HTMLButtonElement>("notation_flat").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLButtonElement>("notation_flat").getAttribute("aria-pressed")).toBe(
      "true"
    );
    requireElement<HTMLButtonElement>("notation_sharp").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLButtonElement>("notation_sharp").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("toggles output format for ChordPro text", () => {
    initPaste();
    type("[C]Twinkle [G]twinkle");
    vi.advanceTimersByTime(300);
    requireElement<HTMLButtonElement>("format_plain").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLButtonElement>("format_plain").getAttribute("aria-pressed")).toBe(
      "true"
    );
    requireElement<HTMLButtonElement>("format_chordpro").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLButtonElement>("format_chordpro").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("picks keys from the visual grid, transposes, and saves the choice", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    requireElement<HTMLButtonElement>("text_target_key_trigger").click();
    expect(requireElement("text_key_picker_title").textContent).toBe("Desired key");
    requireElement("text_key_picker")
      .querySelector<HTMLButtonElement>('button[data-key="G"]')!
      .click();
    expect(requireElement<HTMLSelectElement>("text_target_key").value).toBe("G");
    expect(requireElement("text_target_key_label").textContent).toBe("G");
    expect(requireElement("text_key_distance").textContent).toBe("−5 semitones");
    expect(output().textContent).toContain("G D Em C");
    expect(JSON.parse(localStorage.getItem("chord-transposer:prefs")!).targetKey).toBe("G");
  });

  it("refreshes the key labels after detection and swapping", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "D";
    requireElement<HTMLSelectElement>("text_target_key").value = "C";
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(requireElement("text_current_key_label").textContent).toBe("G");
    requireElement<HTMLButtonElement>("text_swap").dispatchEvent(new Event("click"));
    expect(requireElement("text_current_key_label").textContent).toBe("C");
    expect(requireElement("text_target_key_label").textContent).toBe("G");
  });

  it("hides the semitone distance in nashville mode", () => {
    initPaste();
    requireElement<HTMLButtonElement>("mode-nashville").dispatchEvent(new Event("click"));
    expect(requireElement("text_key_distance_wrap").classList.contains("hidden")).toBe(true);
    requireElement<HTMLButtonElement>("mode-key").dispatchEvent(new Event("click"));
    expect(requireElement("text_key_distance_wrap").classList.contains("hidden")).toBe(false);
  });

  it("swaps keys", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "G";
    requireElement<HTMLButtonElement>("text_swap").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    expect(requireElement<HTMLSelectElement>("text_target_key").value).toBe("C");
  });

  it("reacts to key select changes", () => {
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    requireElement<HTMLSelectElement>("text_target_key").dispatchEvent(new Event("change"));
    requireElement<HTMLSelectElement>("text_current_key").dispatchEvent(new Event("change"));
    expect(status()).toContain("→");
  });

  it("changes instrument and closes the popover", () => {
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    const instrument = requireElement<HTMLSelectElement>("text_instrument");
    instrument.value = "piano";
    instrument.dispatchEvent(new Event("change"));
    expect(requireElement("capo-suggestion").classList.contains("hidden")).toBe(true);
  });

  it("shows a capo suggestion for guitar in key mode", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "G";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(requireElement("capo-suggestion").classList.contains("hidden")).toBe(false);
  });

  it("loads the sample and clears it", () => {
    initPaste();
    const input = requireElement<HTMLTextAreaElement>("text_input");
    input.focus = vi.fn();
    requireElement<HTMLButtonElement>("text_sample").dispatchEvent(new Event("click"));
    expect(input.value).toContain("Amazing grace");
    requireElement<HTMLButtonElement>("text_clear").dispatchEvent(new Event("click"));
    expect(input.value).toBe("");
  });

  it("opens the stage view from output", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    requireElement<HTMLButtonElement>("text_stage").dispatchEvent(new Event("click"));
    expect(document.querySelector('[aria-label="Performance view"]')).not.toBeNull();
  });

  it("does not open the stage view without output", () => {
    initPaste();
    requireElement<HTMLButtonElement>("text_stage").dispatchEvent(new Event("click"));
    expect(document.querySelector('[role="dialog"][aria-label="Performance view"]')).toBeNull();
  });

  it("renders plain output for chordpro text when plain format is selected", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    requireElement<HTMLButtonElement>("format_plain").dispatchEvent(new Event("click"));
    type("[C]Twinkle [G]twinkle");
    vi.advanceTimersByTime(300);
    expect(output().textContent).not.toContain("[");
    expect(output().textContent).toContain("D");
  });

  it("reports invalid keys", () => {
    initPaste();
    const currentKey = requireElement<HTMLSelectElement>("text_current_key");
    const bad = document.createElement("option");
    bad.value = "??";
    currentKey.appendChild(bad);
    currentKey.value = "??";
    currentKey.dispatchEvent(new Event("change"));
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("not a valid key");
  });

  it("preselects the detected key and shows the badge", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "D";
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    expect(requireElement("text_detected_label").textContent).toBe("Detected: G");
    expect(requireElement("text_detected_wrap").classList.contains("hidden")).toBe(false);
  });

  it("does not override a key the user picked", () => {
    initPaste();
    const currentKey = requireElement<HTMLSelectElement>("text_current_key");
    currentKey.value = "D";
    currentKey.dispatchEvent(new Event("change"));
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(currentKey.value).toBe("D");
    expect(requireElement("text_detected_label").textContent).toBe("Detected: G");
  });

  it("locks detection when a landing page preselects the key", () => {
    buildDom({ preselectFrom: "D" });
    initPaste();
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("D");
    expect(requireElement("text_detected_label").textContent).toBe("Detected: G");
  });

  it("switches to the ambiguous alternate and retransposes", () => {
    initPaste();
    const currentKey = requireElement<HTMLSelectElement>("text_current_key");
    const alt = requireElement<HTMLButtonElement>("text_detected_alt");
    const amOption = document.createElement("option");
    amOption.value = "Am";
    currentKey.appendChild(amOption);
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    type("Am F C G\nAm F C G\nAm");
    vi.advanceTimersByTime(300);
    expect(currentKey.value).toBe("Am");
    expect(alt.textContent).toBe("or C?");
    alt.dispatchEvent(new Event("click"));
    expect(currentKey.value).toBe("C");
    expect(status()).toContain("C →");
  });

  it("detects the sample key and hides the badge on clear", () => {
    initPaste();
    requireElement<HTMLButtonElement>("text_sample").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    expect(requireElement("text_detected_label").textContent).toBe("Detected: G");
    requireElement<HTMLButtonElement>("text_clear").dispatchEvent(new Event("click"));
    expect(requireElement("text_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("copies output to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    requireElement<HTMLButtonElement>("text_copy").dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(requireElement<HTMLButtonElement>("text_copy").textContent).toBe("Copied");
    vi.advanceTimersByTime(1600);
  });

  it("reports a clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    requireElement<HTMLButtonElement>("text_copy").dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(status()).toContain("Could not copy"));
  });
});

describe("initPaste preferences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  function stubPrefs(prefs: Prefs, setItem: (key: string, value: string) => void = () => {}) {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(prefs),
      setItem,
      removeItem: () => {},
    });
  }

  function savedKeys(setItem: Mock): Prefs {
    const last = setItem.mock.calls.at(-1)!;
    return JSON.parse(last[1]) as Prefs;
  }

  it("detects the key of text already in the box on load", () => {
    buildDom();
    stubPrefs({ currentKey: "C" });
    requireElement<HTMLTextAreaElement>("text_input").value = "G C D7 G\nEm C D7 G";
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    expect(requireElement("text_detected_label").textContent).toBe("Detected: G");
  });

  it("keeps a restored key when the box is empty on load", () => {
    buildDom();
    stubPrefs({ currentKey: "G" });
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    expect(requireElement("text_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("never writes a detected key to preferences", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({ currentKey: "C", targetKey: "D" }, setItem);
    initPaste();
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    requireElement<HTMLButtonElement>("notation_flat").dispatchEvent(new Event("click"));
    expect(savedKeys(setItem).currentKey).toBe("C");
  });

  it("writes a key the user picked", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({ currentKey: "C", targetKey: "D" }, setItem);
    initPaste();
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    const currentKey = requireElement<HTMLSelectElement>("text_current_key");
    currentKey.value = "D";
    currentKey.dispatchEvent(new Event("change"));
    expect(savedKeys(setItem).currentKey).toBe("D");
  });

  it("writes the key chosen from the ambiguous alternate", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({ currentKey: "C", targetKey: "D" }, setItem);
    const currentKey = requireElement<HTMLSelectElement>("text_current_key");
    const amOption = document.createElement("option");
    amOption.value = "Am";
    currentKey.appendChild(amOption);
    initPaste();
    type("Am F C G\nAm F C G\nAm");
    vi.advanceTimersByTime(300);
    expect(currentKey.value).toBe("Am");
    requireElement<HTMLButtonElement>("text_detected_alt").dispatchEvent(new Event("click"));
    expect(savedKeys(setItem).currentKey).toBe("C");
  });

  it("restores saved preferences on load", () => {
    buildDom();
    stubPrefs({
      mode: "semitone",
      currentKey: "G",
      targetKey: "D",
      semitones: 3,
      notation: "flat",
      instrument: "piano",
    });
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("G");
    expect(requireElement<HTMLSelectElement>("text_target_key").value).toBe("D");
    expect(requireElement("semitone_value").textContent).toBe("+3");
    expect(requireElement<HTMLSelectElement>("text_instrument").value).toBe("piano");
    expect(requireElement<HTMLButtonElement>("notation_flat").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("defaults the instrument to the page instrument when set", () => {
    buildDom({ dataInstrument: "ukulele" });
    stubPrefs({});
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_instrument").value).toBe("ukulele");
  });

  it("prefers the page instrument over a saved instrument", () => {
    buildDom({ dataInstrument: "ukulele" });
    stubPrefs({ instrument: "piano" });
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_instrument").value).toBe("ukulele");
  });

  it("falls back to the guitar when the saved instrument is unknown", () => {
    buildDom();
    stubPrefs({ instrument: "banjo" });
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_instrument").value).toBe("guitar");
  });

  it("falls back to the guitar when the select reports an unknown instrument", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({}, setItem);
    initPaste();
    const select = requireElement<HTMLSelectElement>("text_instrument");
    const unknown = document.createElement("option");
    unknown.value = "banjo";
    select.appendChild(unknown);
    select.value = "banjo";
    select.dispatchEvent(new Event("change"));
    expect(savedKeys(setItem).instrument).toBe("guitar");
  });

  it("uses the saved instrument when the page sets none", () => {
    buildDom();
    stubPrefs({ instrument: "piano" });
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_instrument").value).toBe("piano");
  });

  it("prefers preselect attributes over saved keys", () => {
    buildDom({ preselectFrom: "D", preselectTo: "G" });
    stubPrefs({ currentKey: "C", targetKey: "C" });
    initPaste();
    expect(requireElement<HTMLSelectElement>("text_current_key").value).toBe("D");
    expect(requireElement<HTMLSelectElement>("text_target_key").value).toBe("G");
  });

  it("falls back to key mode for an unknown saved mode", () => {
    buildDom();
    stubPrefs({ mode: "bogus" });
    initPaste();
    expect(requireElement<HTMLButtonElement>("mode-key").getAttribute("aria-selected")).toBe(
      "true"
    );
  });
});
