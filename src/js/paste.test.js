import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initPaste } from "./paste.js";

const PANEL_ATTRS = {
  maxSemitones: "11",
};

function buildDom(attrs = {}) {
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
      <select id="text_target_key"><option value="C">C</option><option value="D">D</option><option value="G">G</option></select>
      <div><button id="text_swap"></button></div>
      <span id="text_linecount"></span>
      <button id="text_sample"></button>
      <button id="text_clear"></button>
      <button id="mode-key"></button>
      <button id="mode-semitone"></button>
      <button id="mode-nashville"></button>
      <div id="controls-key"></div>
      <div id="controls-semitone"></div>
      <label for="text_current_key"></label>
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

function type(text) {
  const input = document.getElementById("text_input");
  input.value = text;
  input.dispatchEvent(new Event("input"));
}

describe("initPaste", () => {
  beforeEach(() => {
    buildDom();
    vi.useFakeTimers();
    let store = {};
    vi.stubGlobal("localStorage", {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
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
    return document.getElementById("text_output");
  }
  function status() {
    return document.getElementById("text_status").textContent;
  }

  it("clears output for empty input", () => {
    initPaste();
    type("   ");
    vi.advanceTimersByTime(300);
    expect(output().textContent).toBe("");
    expect(document.getElementById("text_copy").disabled).toBe(true);
  });

  it("transposes plain chord text between keys", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(output().textContent).toContain("D");
    expect(status()).toContain("C → D");
  });

  function changes() {
    return document.getElementById("text_changes");
  }
  function changesWrap() {
    return document.getElementById("text_changes_wrap");
  }
  function changesToggle() {
    return document.getElementById("text_changes_toggle");
  }

  it("lists de-duplicated from→to chord mappings by key", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("C G Am F\nC G");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    const pills = [...changes().querySelectorAll("span")].map((p) => p.textContent);
    expect(pills).toContain("C → D");
    expect(pills.filter((p) => p === "C → D")).toHaveLength(1);
  });

  it("keeps the pill list collapsed until the toggle is clicked", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changes().classList.contains("hidden")).toBe(true);
    expect(changesToggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("text_changes_label").textContent).toContain("Show");
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().classList.contains("hidden")).toBe(false);
    expect(changesToggle().getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("text_changes_label").textContent).toContain("Hide");
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().classList.contains("hidden")).toBe(true);
    expect(document.getElementById("text_changes_label").textContent).toContain("Show");
  });

  it("resets the pill list to collapsed on a new transpose", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
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
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    document.getElementById("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    changesToggle().dispatchEvent(new Event("click"));
    expect(changes().querySelectorAll("span").length).toBeGreaterThan(0);
  });

  it("hides the change list when no chords change", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("just lyrics with no chords");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
    expect(changes().querySelectorAll("span").length).toBe(0);
  });

  it("hides the change list in nashville mode", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("mode-nashville").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list when input is cleared", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    type("   ");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list when the two keys are identical", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(false);
    document.getElementById("text_target_key").value = "C";
    document.getElementById("text_target_key").dispatchEvent(new Event("change"));
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list at zero semitones", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("hides the change list when an invalid key is used", () => {
    initPaste();
    const currentKey = document.getElementById("text_current_key");
    const bad = document.createElement("option");
    bad.value = "??";
    currentKey.appendChild(bad);
    currentKey.value = "??";
    currentKey.dispatchEvent(new Event("change"));
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(changesWrap().classList.contains("hidden")).toBe(true);
  });

  it("warns when the two keys are identical", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "C";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("different keys");
  });

  it("updates the line count", () => {
    initPaste();
    type("line one\nline two");
    expect(document.getElementById("text_linecount").textContent).toBe("2 lines");
    type("only one");
    expect(document.getElementById("text_linecount").textContent).toBe("1 line");
  });

  it("switches to semitone mode and shifts", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    document.getElementById("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(document.getElementById("semitone_value").textContent).toBe("+1");
    expect(status()).toContain("semitone");
  });

  it("labels a single downward semitone with a flat accidental", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    document.getElementById("notation_flat").dispatchEvent(new Event("click"));
    type("C G Am F");
    document.getElementById("semitone_down").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(status()).toContain("−1 semitone (♭)");
  });

  it("labels multiple upward semitones with a sharp accidental", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    document.querySelector(".semitone-quick").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(status()).toContain("+5 semitones (♯)");
  });

  it("shifts chordpro text by semitones", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("[C]Twinkle [G]twinkle");
    document.getElementById("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(output().textContent).toContain("[");
    expect(status()).toContain("semitone");
  });

  it("reports when no chords are found to change", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("just some lyrics with no chords");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("no chords found");
  });

  it("reports a single changed chord in the singular", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("C\nlyrics here");
    document.getElementById("semitone_up").dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(300);
    expect(status()).toContain("1 chord changed");
  });

  it("shows the no-shift hint at zero semitones", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("No shift");
  });

  it("decrements and clamps semitones", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    document.getElementById("semitone_down").dispatchEvent(new Event("click"));
    expect(document.getElementById("semitone_value").textContent).toBe("-1");
  });

  it("applies a quick semitone preset", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    document.querySelector(".semitone-quick").dispatchEvent(new Event("click"));
    expect(document.getElementById("semitone_value").textContent).toBe("+5");
  });

  it("responds to [ and ] keyboard shortcuts in semitone mode", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(document.getElementById("semitone_value").textContent).toBe("+1");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "[" }));
    expect(document.getElementById("semitone_value").textContent).toBe("0");
  });

  it("ignores keyboard shortcuts outside semitone mode", () => {
    initPaste();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "]" }));
    expect(document.getElementById("semitone_value").textContent).toBe("0");
  });

  it("ignores keyboard shortcuts while typing in a field", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    const event = new KeyboardEvent("keydown", { key: "]" });
    Object.defineProperty(event, "target", { value: document.getElementById("text_input") });
    document.dispatchEvent(event);
    expect(document.getElementById("semitone_value").textContent).toBe("0");
  });

  it("switches to nashville mode", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("mode-nashville").dispatchEvent(new Event("click"));
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("Nashville");
  });

  it("toggles notation between sharp and flat", () => {
    initPaste();
    document.getElementById("mode-semitone").dispatchEvent(new Event("click"));
    document.getElementById("notation_flat").dispatchEvent(new Event("click"));
    expect(document.getElementById("notation_flat").getAttribute("aria-pressed")).toBe("true");
    document.getElementById("notation_sharp").dispatchEvent(new Event("click"));
    expect(document.getElementById("notation_sharp").getAttribute("aria-pressed")).toBe("true");
  });

  it("toggles output format for ChordPro text", () => {
    initPaste();
    type("[C]Twinkle [G]twinkle");
    vi.advanceTimersByTime(300);
    document.getElementById("format_plain").dispatchEvent(new Event("click"));
    expect(document.getElementById("format_plain").getAttribute("aria-pressed")).toBe("true");
    document.getElementById("format_chordpro").dispatchEvent(new Event("click"));
    expect(document.getElementById("format_chordpro").getAttribute("aria-pressed")).toBe("true");
  });

  it("swaps keys", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "G";
    document.getElementById("text_swap").dispatchEvent(new Event("click"));
    expect(document.getElementById("text_current_key").value).toBe("G");
    expect(document.getElementById("text_target_key").value).toBe("C");
  });

  it("reacts to key select changes", () => {
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    document.getElementById("text_target_key").value = "D";
    document.getElementById("text_target_key").dispatchEvent(new Event("change"));
    document.getElementById("text_current_key").dispatchEvent(new Event("change"));
    expect(status()).toContain("→");
  });

  it("changes instrument and closes the popover", () => {
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    const instrument = document.getElementById("text_instrument");
    instrument.value = "piano";
    instrument.dispatchEvent(new Event("change"));
    expect(document.getElementById("capo-suggestion").classList.contains("hidden")).toBe(true);
  });

  it("shows a capo suggestion for guitar in key mode", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "G";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(document.getElementById("capo-suggestion").classList.contains("hidden")).toBe(false);
  });

  it("loads the sample and clears it", () => {
    initPaste();
    const input = document.getElementById("text_input");
    input.focus = vi.fn();
    document.getElementById("text_sample").dispatchEvent(new Event("click"));
    expect(input.value).toContain("Amazing grace");
    document.getElementById("text_clear").dispatchEvent(new Event("click"));
    expect(input.value).toBe("");
  });

  it("opens the stage view from output", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    document.getElementById("text_stage").dispatchEvent(new Event("click"));
    expect(document.querySelector('[aria-label="Performance view"]')).not.toBeNull();
  });

  it("does not open the stage view without output", () => {
    initPaste();
    document.getElementById("text_stage").dispatchEvent(new Event("click"));
    expect(document.querySelector('[role="dialog"][aria-label="Performance view"]')).toBeNull();
  });

  it("renders plain output for chordpro text when plain format is selected", () => {
    initPaste();
    document.getElementById("text_current_key").value = "C";
    document.getElementById("text_target_key").value = "D";
    document.getElementById("format_plain").dispatchEvent(new Event("click"));
    type("[C]Twinkle [G]twinkle");
    vi.advanceTimersByTime(300);
    expect(output().textContent).not.toContain("[");
    expect(output().textContent).toContain("D");
  });

  it("reports invalid keys", () => {
    initPaste();
    const currentKey = document.getElementById("text_current_key");
    const bad = document.createElement("option");
    bad.value = "??";
    currentKey.appendChild(bad);
    currentKey.value = "??";
    currentKey.dispatchEvent(new Event("change"));
    document.getElementById("text_target_key").value = "D";
    type("C G Am F");
    vi.advanceTimersByTime(300);
    expect(status()).toContain("not a valid key");
  });

  it("preselects the detected key and shows the badge", () => {
    initPaste();
    document.getElementById("text_current_key").value = "D";
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(document.getElementById("text_current_key").value).toBe("G");
    expect(document.getElementById("text_detected_label").textContent).toBe("Detected: G");
    expect(document.getElementById("text_detected_wrap").classList.contains("hidden")).toBe(false);
  });

  it("does not override a key the user picked", () => {
    initPaste();
    const currentKey = document.getElementById("text_current_key");
    currentKey.value = "D";
    currentKey.dispatchEvent(new Event("change"));
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(currentKey.value).toBe("D");
    expect(document.getElementById("text_detected_label").textContent).toBe("Detected: G");
  });

  it("locks detection when a landing page preselects the key", () => {
    buildDom({ preselectFrom: "D" });
    initPaste();
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(document.getElementById("text_current_key").value).toBe("D");
    expect(document.getElementById("text_detected_label").textContent).toBe("Detected: G");
  });

  it("switches to the ambiguous alternate and retransposes", () => {
    initPaste();
    const currentKey = document.getElementById("text_current_key");
    const alt = document.getElementById("text_detected_alt");
    const amOption = document.createElement("option");
    amOption.value = "Am";
    currentKey.appendChild(amOption);
    document.getElementById("text_target_key").value = "D";
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
    document.getElementById("text_sample").dispatchEvent(new Event("click"));
    expect(document.getElementById("text_current_key").value).toBe("G");
    expect(document.getElementById("text_detected_label").textContent).toBe("Detected: G");
    document.getElementById("text_clear").dispatchEvent(new Event("click"));
    expect(document.getElementById("text_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("copies output to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    document.getElementById("text_copy").dispatchEvent(new Event("click"));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(document.getElementById("text_copy").textContent).toBe("Copied");
    vi.advanceTimersByTime(1600);
  });

  it("reports a clipboard failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    initPaste();
    type("C G Am F");
    vi.advanceTimersByTime(300);
    document.getElementById("text_copy").dispatchEvent(new Event("click"));
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

  function stubPrefs(prefs, setItem = () => {}) {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(prefs),
      setItem,
      removeItem: () => {},
    });
  }

  function savedKeys(setItem) {
    const last = setItem.mock.calls.at(-1);
    return JSON.parse(last[1]);
  }

  it("detects the key of text already in the box on load", () => {
    buildDom();
    stubPrefs({ currentKey: "C" });
    document.getElementById("text_input").value = "G C D7 G\nEm C D7 G";
    initPaste();
    expect(document.getElementById("text_current_key").value).toBe("G");
    expect(document.getElementById("text_detected_label").textContent).toBe("Detected: G");
  });

  it("keeps a restored key when the box is empty on load", () => {
    buildDom();
    stubPrefs({ currentKey: "G" });
    initPaste();
    expect(document.getElementById("text_current_key").value).toBe("G");
    expect(document.getElementById("text_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("never writes a detected key to preferences", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({ currentKey: "C", targetKey: "D" }, setItem);
    initPaste();
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    expect(document.getElementById("text_current_key").value).toBe("G");
    document.getElementById("notation_flat").dispatchEvent(new Event("click"));
    expect(savedKeys(setItem).currentKey).toBe("C");
  });

  it("writes a key the user picked", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({ currentKey: "C", targetKey: "D" }, setItem);
    initPaste();
    type("G C D7 G\nEm C D7 G");
    vi.advanceTimersByTime(300);
    const currentKey = document.getElementById("text_current_key");
    currentKey.value = "D";
    currentKey.dispatchEvent(new Event("change"));
    expect(savedKeys(setItem).currentKey).toBe("D");
  });

  it("writes the key chosen from the ambiguous alternate", () => {
    buildDom();
    const setItem = vi.fn();
    stubPrefs({ currentKey: "C", targetKey: "D" }, setItem);
    const currentKey = document.getElementById("text_current_key");
    const amOption = document.createElement("option");
    amOption.value = "Am";
    currentKey.appendChild(amOption);
    initPaste();
    type("Am F C G\nAm F C G\nAm");
    vi.advanceTimersByTime(300);
    expect(currentKey.value).toBe("Am");
    document.getElementById("text_detected_alt").dispatchEvent(new Event("click"));
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
    expect(document.getElementById("text_current_key").value).toBe("G");
    expect(document.getElementById("text_target_key").value).toBe("D");
    expect(document.getElementById("semitone_value").textContent).toBe("+3");
    expect(document.getElementById("text_instrument").value).toBe("piano");
    expect(document.getElementById("notation_flat").getAttribute("aria-pressed")).toBe("true");
  });

  it("defaults the instrument to the page instrument when set", () => {
    buildDom({ dataInstrument: "ukulele" });
    stubPrefs({});
    initPaste();
    expect(document.getElementById("text_instrument").value).toBe("ukulele");
  });

  it("prefers the page instrument over a saved instrument", () => {
    buildDom({ dataInstrument: "ukulele" });
    stubPrefs({ instrument: "piano" });
    initPaste();
    expect(document.getElementById("text_instrument").value).toBe("ukulele");
  });

  it("uses the saved instrument when the page sets none", () => {
    buildDom();
    stubPrefs({ instrument: "piano" });
    initPaste();
    expect(document.getElementById("text_instrument").value).toBe("piano");
  });

  it("prefers preselect attributes over saved keys", () => {
    buildDom({ preselectFrom: "D", preselectTo: "G" });
    stubPrefs({ currentKey: "C", targetKey: "C" });
    initPaste();
    expect(document.getElementById("text_current_key").value).toBe("D");
    expect(document.getElementById("text_target_key").value).toBe("G");
  });

  it("falls back to key mode for an unknown saved mode", () => {
    buildDom();
    stubPrefs({ mode: "bogus" });
    initPaste();
    expect(document.getElementById("mode-key").getAttribute("aria-selected")).toBe("true");
  });
});
