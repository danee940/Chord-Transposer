import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireElement } from "./dom";
vi.mock("./transpose/index", async () => {
  const actual = await vi.importActual("./transpose/index");
  return {
    ...actual,
    transposeText: () => {
      throw new Error("boom");
    },
  };
});

import { initPaste } from "./paste";

function buildDom() {
  document.body.innerHTML = `
    <div id="panel-paste" data-max-semitones="11">
      <textarea id="text_input"></textarea>
      <div id="text_output"></div>
      <div id="text_status"></div>
      <button id="text_copy"></button>
      <select id="text_current_key"><option value="C">C</option><option value="D">D</option></select>
      <select id="text_target_key"><option value="C">C</option><option value="D">D</option></select>
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
      <select id="text_instrument"><option value="guitar">Guitar</option></select>
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

describe("initPaste error handling", () => {
  beforeEach(() => {
    buildDom();
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("shows a generic message for unexpected errors", () => {
    initPaste();
    requireElement<HTMLSelectElement>("text_current_key").value = "C";
    requireElement<HTMLSelectElement>("text_target_key").value = "D";
    const input = requireElement<HTMLTextAreaElement>("text_input");
    input.value = "C G Am F";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(300);
    expect(requireElement("text_status").textContent).toBe("Something went wrong.");
  });
});
