import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChangesDisclosure } from "./changes-disclosure";
import { requireElement } from "./dom";
import { transposeText } from "./transpose/index";
import { createUploadPreview, type UploadPreview } from "./upload-preview";

interface Harness {
  preview: UploadPreview;
  wrap: HTMLElement;
  status: HTMLElement;
  reset: HTMLButtonElement;
  text: HTMLTextAreaElement;
  changes: ChangesDisclosure;
  errors: string[];
  hideNotice: ReturnType<typeof vi.fn>;
  beforeRun: ReturnType<typeof vi.fn>;
  keys: { from: string; to: string };
  selectionId: { value: number };
}

function harness(): Harness {
  document.body.innerHTML = `
    <div id="wrap" class="hidden">
      <span id="status"></span>
      <button id="reset" class="hidden"></button>
      <textarea id="text"></textarea>
    </div>`;
  const wrap = requireElement("wrap");
  const status = requireElement("status");
  const reset = requireElement<HTMLButtonElement>("reset");
  const text = requireElement<HTMLTextAreaElement>("text");
  const changes: ChangesDisclosure = { show: vi.fn(), hide: vi.fn() };
  const errors: string[] = [];
  const hideNotice = vi.fn();
  const beforeRun = vi.fn();
  const keys = { from: "C", to: "D" };
  const selectionId = { value: 1 };

  const preview = createUploadPreview({
    elements: { wrap, status, reset, text },
    changes,
    getKeys: () => keys,
    getSelectionId: () => selectionId.value,
    transposeSheet: (value, from, to) => transposeText(value, from, to),
    beforeRun,
    onError: (message) => errors.push(message),
    hideNotice,
  });

  return {
    preview,
    wrap,
    status,
    reset,
    text,
    changes,
    errors,
    hideNotice,
    beforeRun,
    keys,
    selectionId,
  };
}

let h: Harness;

beforeEach(() => {
  h = harness();
});

describe("loading a source sheet", () => {
  it("transposes and shows the preview", () => {
    h.preview.loadSource(["C G Am F", "Amazing grace"], 1);

    expect(h.wrap.classList.contains("hidden")).toBe(false);
    expect(h.text.value).toBe("D A Bm G\nAmazing grace");
    expect(h.status.textContent).toBe("Preview · C → D");
    expect(h.changes.show).toHaveBeenCalledOnce();
    expect(h.beforeRun).toHaveBeenCalled();
  });

  it("ignores a stale selection", () => {
    h.selectionId.value = 2;
    h.preview.loadSource(["C G"], 1);
    expect(h.wrap.classList.contains("hidden")).toBe(true);
  });

  it("ignores an empty document", () => {
    h.preview.loadSource([], 1);
    expect(h.wrap.classList.contains("hidden")).toBe(true);
  });

  it("notes when a sheet has no chords to change", () => {
    h.preview.loadSource(["just lyrics here"], 1);
    expect(h.status.textContent).toBe("Preview · C → D · no chords found to change");
    expect(h.changes.hide).toHaveBeenCalled();
  });
});

describe("key changes", () => {
  it("hides the preview when both keys match", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.keys.to = "C";
    h.preview.run();
    expect(h.wrap.classList.contains("hidden")).toBe(true);
    expect(h.hideNotice).toHaveBeenCalled();
  });

  it("reports an invalid key through onError", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.keys.to = "Q";
    h.preview.run();
    expect(h.errors[0]).toMatch(/not a valid key/);
  });

  it("does nothing before a sheet is loaded", () => {
    h.preview.run();
    expect(h.wrap.classList.contains("hidden")).toBe(true);
    expect(h.errors).toEqual([]);
  });
});

describe("held edits", () => {
  it("carries an edit across a key change, transposed to the new key", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.text.value = "D A Bm7 G";

    h.keys.to = "G";
    h.preview.rerun();

    expect(h.text.value).toBe("G D Em7 C");
  });

  it("lets a widened chord consume a following space to hold its column", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.text.value = "D A Bm7 G";

    h.keys.to = "E";
    h.preview.rerun();

    expect(h.text.value).toBe("E B C#m7A");
  });

  it("keeps an edit verbatim when the key is unchanged", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.text.value = "D A Bm7 G";
    h.preview.rerun();
    expect(h.text.value).toBe("D A Bm7 G");
  });

  it("leaves untouched paragraphs transposed normally", () => {
    h.preview.loadSource(["C G Am F", "C G"], 1);
    h.text.value = "D A Bm7 G\nD A";
    h.keys.to = "G";
    h.preview.rerun();
    expect(h.text.value).toBe("G D Em7 C\nG D");
  });

  it("hold() captures edits without re-running", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.text.value = "D A Bm7 G";
    h.preview.hold();
    h.keys.to = "G";
    h.preview.run();
    expect(h.text.value).toBe("G D Em7 C");
  });
});

describe("collectEdits", () => {
  it("reports nothing when the preview is untouched", () => {
    h.preview.loadSource(["C G Am F"], 1);
    expect(h.preview.collectEdits()).toEqual([]);
  });

  it("reports nothing before a sheet is loaded", () => {
    expect(h.preview.collectEdits()).toEqual([]);
  });

  it("pairs each edited paragraph with its source", () => {
    h.preview.loadSource(["C G Am F", "lyrics"], 1);
    h.text.value = "D A Bm7 G\nlyrics";
    expect(h.preview.collectEdits()).toEqual([{ index: 0, source: "C G Am F", text: "D A Bm7 G" }]);
  });
});

describe("reset button", () => {
  it("appears once the text diverges and restores the generated text", () => {
    h.preview.loadSource(["C G Am F"], 1);
    expect(h.reset.classList.contains("hidden")).toBe(true);

    h.text.value = "D A Bm7 G";
    h.preview.syncResetButton();
    expect(h.reset.classList.contains("hidden")).toBe(false);

    h.preview.restore();
    expect(h.text.value).toBe("D A Bm G");
    expect(h.reset.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(h.text);
  });
});

describe("reset()", () => {
  it("clears the sheet, the preview and any held edits", () => {
    h.preview.loadSource(["C G Am F"], 1);
    h.text.value = "D A Bm7 G";
    h.preview.hold();

    h.preview.reset();

    expect(h.wrap.classList.contains("hidden")).toBe(true);
    expect(h.text.value).toBe("");
    expect(h.preview.isHidden()).toBe(true);

    h.preview.run();
    expect(h.wrap.classList.contains("hidden")).toBe(true);
  });
});
