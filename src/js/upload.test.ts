import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from "vitest";

import { requireElement } from "./dom";
import { docxFile } from "./testing/docx-fixture";
import { initUpload } from "./upload";

function setupDom() {
  document.body.innerHTML = `
    <form id="form">
      <input id="file" type="file" name="file" multiple />
      <div id="dropzone"><span id="dropzone-text"></span></div>
      <select id="current_key"><option value="C">C</option><option value="D">D</option><option value="E">E</option></select>
      <select id="target_key"><option value="C">C</option><option value="D">D</option><option value="E">E</option></select>
      <button id="swap" type="button"></button>
      <button id="current_key_trigger" type="button"><span id="current_key_label"></span></button>
      <button id="target_key_trigger" type="button"><span id="target_key_label"></span></button>
      <div id="key_picker" class="hidden"><div id="key_picker_title"></div></div>
      <p id="key_distance"></p>
      <span id="upload_detected_wrap" class="hidden">
        <span id="upload_detected_label"></span>
        <button id="upload_detected_alt" type="button" class="hidden"></button>
      </span>
      <label><input type="radio" name="format" value="docx" checked /></label>
      <label><input type="radio" name="format" value="pdf" /></label>
      <button id="submit" type="submit"><span id="submit-label"></span><span id="spinner"></span></button>
      <div id="upload_preview" class="hidden">
        <span id="upload_preview_status"></span>
        <button id="upload_preview_reset" type="button" class="hidden"></button>
        <textarea id="upload_preview_text"></textarea>
        <div id="upload_changes_wrap" class="hidden">
          <button id="upload_changes_toggle" type="button"><svg id="upload_changes_caret"></svg><span id="upload_changes_label"></span></button>
          <div id="upload_changes" class="hidden"></div>
        </div>
      </div>
      <div id="message"></div>
    </form>
  `;
}

function makeFile(name: string, size: number) {
  const file = new File(["x".repeat(Math.max(size, 0))], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function makeTextFile(name: string, content: string) {
  const file = new File([content], name);
  Object.defineProperty(file, "size", { value: content.length });
  file.text = () => Promise.resolve(content);
  return file;
}

function setFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files, configurable: true });
}

interface ResponseOverrides {
  headers?: Record<string, string | null>;
  json?: unknown;
  top?: Record<string, unknown>;
}

function response(overrides: ResponseOverrides = {}) {
  const headers: Record<string, string | null> = {
    "X-Transpose-From": "C",
    "X-Transpose-To": "D",
    "X-Transpose-Changes": "C->D, G->A",
    "Content-Disposition": 'attachment; filename="song.docx"',
    ...overrides.headers,
  };
  return {
    ok: true,
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    json: async () => overrides.json ?? {},
    blob: async () => new Blob(["data"]),
    ...overrides.top,
  };
}

describe("initUpload", () => {
  let clickSpy: MockInstance;
  let fetchMock: Mock;

  beforeEach(() => {
    setupDom();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.DataTransfer = class {
      readonly items: { add: (file: File) => void };
      private readonly storedFiles: File[] = [];
      constructor() {
        this.items = { add: (file: File) => this.storedFiles.push(file) };
      }
      get files(): File[] {
        return this.storedFiles;
      }
    } as unknown as typeof DataTransfer;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function message() {
    return requireElement("message");
  }

  it("validates the file on change and shows the file summary", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(requireElement("dropzone-text").textContent).toContain("song.docx");
  });

  it("detects the key of a text upload and preselects it", async () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(requireElement("upload_detected_label").textContent).toBe("Detected: D")
    );
    expect(requireElement<HTMLSelectElement>("current_key").value).toBe("D");
    expect(requireElement("upload_detected_wrap").classList.contains("hidden")).toBe(false);
  });

  it("asks the server to detect the key of a .docx upload", async () => {
    initUpload();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ key: "D", alternate: null, ambiguous: false, chords: 4, distinct: 3 }),
    });
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(requireElement("upload_detected_label").textContent).toBe("Detected: D")
    );
    expect(fetch).toHaveBeenCalledWith("/detect-key", expect.objectContaining({ method: "POST" }));
    expect(requireElement<HTMLSelectElement>("current_key").value).toBe("D");
  });

  it("ignores a failed .docx key detection response", async () => {
    initUpload();
    fetchMock.mockResolvedValue({ ok: false });
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(requireElement<HTMLSelectElement>("current_key").value).toBe("C");
    expect(requireElement("upload_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("ignores a malformed key detection payload", async () => {
    initUpload();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ nonsense: true }) });
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(requireElement("upload_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("ignores a key detection network error", async () => {
    initUpload();
    fetchMock.mockRejectedValue(new Error("offline"));
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(requireElement("upload_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("discards a stale .docx detection response", async () => {
    initUpload();
    let resolveFirst!: (value: unknown) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    fetchMock.mockReturnValueOnce(firstResponse).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: "D", alternate: null, ambiguous: false, chords: 4, distinct: 3 }),
    });
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("a.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    setFiles(fileInput, [makeFile("b.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(requireElement("upload_detected_label").textContent).toBe("Detected: D")
    );
    resolveFirst({
      ok: true,
      json: async () => ({ key: "C", alternate: null, ambiguous: false, chords: 4, distinct: 3 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requireElement("upload_detected_label").textContent).toBe("Detected: D");
    expect(requireElement<HTMLSelectElement>("current_key").value).toBe("D");
  });

  it("discards a stale text file read after a newer selection", async () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    let resolveFirst!: (value: string) => void;
    const slow = makeFile("slow.txt", 10);
    slow.text = () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      });
    setFiles(fileInput, [slow]);
    fileInput.dispatchEvent(new Event("change"));
    setFiles(fileInput, [makeTextFile("fast.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(requireElement("upload_detected_label").textContent).toBe("Detected: D")
    );
    resolveFirst("C F G7 C");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requireElement("upload_detected_label").textContent).toBe("Detected: D");
    expect(requireElement<HTMLSelectElement>("current_key").value).toBe("D");
  });

  it("skips key detection for multi-file binders", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("b.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("re-detects after a new file resets the user pick", async () => {
    initUpload();
    const currentKey = requireElement<HTMLSelectElement>("current_key");
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(currentKey.value).toBe("D"));
    currentKey.value = "C";
    currentKey.dispatchEvent(new Event("change"));
    setFiles(fileInput, [makeTextFile("again.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(currentKey.value).toBe("D"));
  });

  function preview() {
    return requireElement("upload_preview");
  }

  function previewText() {
    return requireElement<HTMLTextAreaElement>("upload_preview_text");
  }

  function previewStatus() {
    return requireElement("upload_preview_status").textContent;
  }

  async function selectAndPreview(file: File) {
    requireElement<HTMLSelectElement>("target_key").value = "D";
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [file]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(preview().classList.contains("hidden")).toBe(false));
  }

  it("accepts a .txt file and previews the transposed text with its chord changes", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics here"));
    expect(previewStatus()).toBe("Preview · C → D");
    expect(requireElement("upload_changes_label").textContent).toBe("Show 4 chord changes");
    expect(previewText().value).toBe("D A Bm G\nlyrics here");
    expect(previewText().rows).toBe(8);
    const rows = [...requireElement("upload_changes").children].map((row) => row.textContent);
    expect(rows).toEqual(["A → B · Am", "C → D", "F → G", "G → A"]);
    expect(requireElement("upload_changes").classList.contains("hidden")).toBe(true);
    expect(requireElement("upload_changes_wrap").classList.contains("hidden")).toBe(false);
  });

  it("collapses the chord changes behind a toggle and expands on demand", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    const wrap = requireElement("upload_changes_wrap");
    const toggle = requireElement("upload_changes_toggle");
    const list = requireElement("upload_changes");
    expect(wrap.classList.contains("hidden")).toBe(false);
    expect(list.classList.contains("hidden")).toBe(true);

    toggle.click();
    expect(list.classList.contains("hidden")).toBe(false);
    expect(requireElement("upload_changes_label").textContent).toBe("Hide 4 chord changes");
    expect(requireElement("upload_changes_caret").classList.contains("rotate-90")).toBe(true);

    toggle.click();
    expect(list.classList.contains("hidden")).toBe(true);
    expect(requireElement("upload_changes_label").textContent).toBe("Show 4 chord changes");
  });

  it("hides the changes toggle when no chords changed", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("notes.txt", "just some words"));
    expect(requireElement("upload_changes_wrap").classList.contains("hidden")).toBe(true);
  });

  it("groups the chord changes by root, one root per line", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C C/E C7 Gsus G7 Am"));
    const rows = [...requireElement("upload_changes").children].map((row) => row.textContent);
    expect(rows).toEqual(["A → B · Am", "C → D · C/E · C7", "G → A · G7 · Gsus"]);
    const [first] = requireElement("upload_changes").children;
    expect(first!.querySelector("span.font-medium")!.textContent).toBe("A → B");
  });

  it("previews ChordPro uploads via the chordpro core", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("grace.pro", "[C]Amazing [G]grace"));
    expect(previewText().value).toBe("[D]Amazing [A]grace");
  });

  it("uses the singular when a single chord changed", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("one.txt", "C"));
    expect(requireElement("upload_changes_label").textContent).toBe("Show 1 chord change");
  });

  it("reports when no chords were found to change", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("notes.txt", "just some words"));
    expect(previewStatus()).toBe("Preview · C → D · no chords found to change");
    expect(requireElement("upload_changes").classList.contains("hidden")).toBe(true);
  });

  it("grows the preview with the text up to a maximum height", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("long.txt", Array(60).fill("C G").join("\n")));
    expect(previewText().rows).toBe(32);
  });

  it("previews a .docx by extracting its paragraphs in the browser", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    initUpload();
    await selectAndPreview(docxFile("song.docx", ["C G Am F", "lyrics"]));
    expect(previewText().value).toBe("D A Bm G\nlyrics");
    expect(fetchMock).toHaveBeenCalledWith("/detect-key", expect.anything());
  });

  it("shows no preview when the .docx cannot be read in the browser", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    expect(preview().classList.contains("hidden")).toBe(true);
  });

  it("shows no preview for a .docx without paragraphs", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [docxFile("empty.docx", [])]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(preview().classList.contains("hidden")).toBe(true);
  });

  it("discards a stale .docx extraction after a newer selection", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    const slow = docxFile("slow.docx", ["C G"]);
    const slowBuffer = slow.arrayBuffer();
    let release: () => void = () => {};
    slow.arrayBuffer = () =>
      new Promise((resolve) => {
        release = () => {
          void slowBuffer.then(resolve);
        };
      });
    setFiles(fileInput, [slow]);
    fileInput.dispatchEvent(new Event("change"));
    setFiles(fileInput, [makeTextFile("fast.txt", "words")]);
    fileInput.dispatchEvent(new Event("change"));
    requireElement<HTMLSelectElement>("target_key").value = "D";
    requireElement<HTMLSelectElement>("target_key").dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(previewText().value).toBe("words"));
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(previewText().value).toBe("words");
  });

  function setTarget(value: string) {
    const target = requireElement<HTMLSelectElement>("target_key");
    target.value = value;
    target.dispatchEvent(new Event("change"));
  }

  function editPreview(value: string) {
    previewText().value = value;
    previewText().dispatchEvent(new Event("input"));
  }

  it("rebases edited paragraphs onto a new target key and regenerates the rest", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics\nF C"));
    editPreview("D A Bm7 G\nlyrics\nG D");
    setTarget("E");
    expect(previewText().value).toBe("E B C#m7A\nlyrics\nA E");
    expect(previewStatus()).toBe("Preview · C → E");
    expect(requireElement("upload_preview_reset").classList.contains("hidden")).toBe(false);
  });

  it("keeps edits as they are when only the current key changes", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nF C"));
    editPreview("D A Bm7 G\nG D");
    const currentKey = requireElement<HTMLSelectElement>("current_key");
    currentKey.value = "E";
    currentKey.dispatchEvent(new Event("change"));
    expect(previewText().value).toBe("D A Bm7 G\nD#A#");
  });

  it("rebases edits when the keys are swapped", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    editPreview("D A Bm7 G");
    requireElement("swap").click();
    expect(previewText().value).toBe("C G Am7 F");
  });

  it("holds edits while the keys match and restores them afterwards", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics"));
    editPreview("D A Bm7 G\nlyrics");
    setTarget("C");
    expect(preview().classList.contains("hidden")).toBe(true);
    setTarget("C");
    setTarget("E");
    expect(previewText().value).toBe("E B C#m7A\nlyrics");
  });

  it("rebases added lines together with their paragraph", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics"));
    editPreview("D A Bm G\nG D\nlyrics");
    setTarget("E");
    expect(previewText().value).toBe("E B C#mA\nA E\nlyrics");
  });

  it("rebases edits made after a detected alternate key is picked", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    editPreview("D A Bm7 G");
    requireElement<HTMLSelectElement>("current_key").value = "E";
    requireElement("upload_detected_alt").click();
    expect(previewText().value).toBe("D A Bm7 G");
  });

  it("picks keys from the visual grid and re-runs the preview", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    const panel = requireElement("key_picker");
    requireElement<HTMLButtonElement>("target_key_trigger").click();
    expect(panel.classList.contains("hidden")).toBe(false);
    expect(requireElement("key_picker_title").textContent).toBe("Desired key");

    panel.querySelector<HTMLButtonElement>('button[data-key="E"]')!.click();
    expect(requireElement<HTMLSelectElement>("target_key").value).toBe("E");
    expect(panel.classList.contains("hidden")).toBe(true);
    expect(requireElement("target_key_label").textContent).toBe("E");
    expect(requireElement("key_distance").textContent).toBe("+4 semitones");
    expect(previewText().value).toBe("E B C#mA");
  });

  it("refreshes the key labels and distance when the keys are swapped", async () => {
    initUpload();
    requireElement<HTMLSelectElement>("target_key").value = "D";
    requireElement<HTMLSelectElement>("target_key").dispatchEvent(new Event("change"));
    requireElement("swap").click();
    expect(requireElement("current_key_label").textContent).toBe("D");
    expect(requireElement("target_key_label").textContent).toBe("C");
    expect(requireElement("key_distance").textContent).toBe("−2 semitones");
  });

  it("re-runs a stale .docx preview once the detected key arrives", async () => {
    let resolveDetect: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (resolveDetect = resolve)));
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    requireElement<HTMLSelectElement>("target_key").value = "E";
    setFiles(fileInput, [docxFile("song.docx", ["C G Am F"])]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(previewText().value).toBe("E B C#mA"));

    resolveDetect({
      ok: true,
      json: async () => ({ key: "D", alternate: null, ambiguous: false, chords: 4, distinct: 4 }),
    });
    await vi.waitFor(() => expect(previewText().value).toBe("D A Bm G"));
    expect(requireElement("current_key_label").textContent).toBe("D");
  });

  it("hides the preview when the keys are the same", async () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "C G Am F")]);
    fileInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    expect(message().className).toContain("hidden");
    expect(preview().classList.contains("hidden")).toBe(true);
  });

  it("re-runs the preview when a key changes and reports invalid keys", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));

    const currentKey = requireElement<HTMLSelectElement>("current_key");
    currentKey.value = "";
    currentKey.dispatchEvent(new Event("change"));
    expect(message().textContent).toContain("not a valid key");
  });

  it("offers to reset edits made in the preview", async () => {
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    const reset = requireElement("upload_preview_reset");
    expect(reset.classList.contains("hidden")).toBe(true);

    previewText().value = "D A Bm7 G";
    previewText().dispatchEvent(new Event("input"));
    expect(reset.classList.contains("hidden")).toBe(false);

    reset.click();
    expect(previewText().value).toBe("D A Bm G");
    expect(reset.classList.contains("hidden")).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.pdf", 500)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("Unsupported file type. Upload .docx, .txt, .pro, or .cho.");
    expect(requireElement("dropzone-text").innerHTML).toContain("Drop your chord sheets");
  });

  it("formats small files in KB", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("song.docx", 500)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(requireElement("dropzone-text").textContent).toContain("KB");
  });

  it("shows MB sizing for larger files", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("big.docx", 3 * 1024 * 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(requireElement("dropzone-text").textContent).toContain("3.0 MB");
  });

  it("rejects empty and oversized files", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("empty.docx", 0)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("The selected file is empty.");

    setFiles(fileInput, [makeFile("huge.docx", 11 * 1024 * 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("File is too large. The maximum size is 10 MB.");
  });

  it("clears the dropzone when no file is selected", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, []);
    fileInput.dispatchEvent(new Event("change"));
    expect(requireElement("dropzone-text").innerHTML).toContain("Drop your chord sheets");
  });

  it("summarises a multi-file binder selection", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("b.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(requireElement("dropzone-text").textContent).toContain("2 files selected");
  });

  it("rejects a binder containing a non-docx file", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("notes.txt", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("The binder accepts .docx files only.");
  });

  it("rejects a binder with an empty member", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("b.docx", 0)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("One of the selected files is empty.");
  });

  it("rejects too many binder files", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    const many = Array.from({ length: 21 }, (_, i) => makeFile(`s${i}.docx`, 10));
    setFiles(fileInput, many);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("Too many files. The maximum is 20.");
  });

  it("rejects a binder that exceeds the combined size limit", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, [
      makeFile("a.docx", 30 * 1024 * 1024),
      makeFile("b.docx", 20 * 1024 * 1024),
    ]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("Files are too large. The combined maximum is 40 MB.");
  });

  it("toggles the dropzone drag styling", () => {
    initUpload();
    const dropzone = requireElement("dropzone");
    dropzone.dispatchEvent(new Event("dragenter"));
    expect(dropzone.classList.contains("border-accent")).toBe(true);
    dropzone.dispatchEvent(new Event("dragleave"));
    expect(dropzone.classList.contains("border-accent")).toBe(false);
  });

  it("accepts dropped files", () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    let assigned: File[] = [];
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      get: () => assigned,
      set: (value: File[]) => {
        assigned = value;
      },
    });
    const dropzone = requireElement("dropzone");
    const event = Object.assign(new Event("drop"), {
      dataTransfer: { files: [makeFile("dropped.docx", 1024)] },
    });
    dropzone.dispatchEvent(event);
    expect(requireElement("dropzone-text").textContent).toContain("dropped.docx");
  });

  it("ignores a drop with no file", () => {
    initUpload();
    const dropzone = requireElement("dropzone");
    const event = Object.assign(new Event("drop"), { dataTransfer: { files: [] } });
    dropzone.dispatchEvent(event);
    expect(requireElement("dropzone-text").textContent).toBe("");
  });

  it("ignores a drop without a dataTransfer", () => {
    initUpload();
    const dropzone = requireElement("dropzone");
    dropzone.dispatchEvent(new Event("drop"));
    expect(requireElement("dropzone-text").textContent).toBe("");
  });

  it("swaps the current and target keys", () => {
    initUpload();
    requireElement<HTMLSelectElement>("current_key").value = "C";
    requireElement<HTMLSelectElement>("target_key").value = "D";
    requireElement<HTMLButtonElement>("swap").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLSelectElement>("current_key").value).toBe("D");
    expect(requireElement<HTMLSelectElement>("target_key").value).toBe("C");
  });

  it("blocks submission without a valid file", async () => {
    initUpload();
    const fileInput = requireElement<HTMLInputElement>("file");
    setFiles(fileInput, []);
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toBe("Please choose a file to upload.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission of an invalid single file", async () => {
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.pdf", 10)]);
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toContain("Unsupported file type");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission of an invalid binder selection", async () => {
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [
      makeFile("a.docx", 10),
      makeFile("b.txt", 10),
    ]);
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toBe("The binder accepts .docx files only.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission when the keys match", async () => {
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    requireElement<HTMLSelectElement>("current_key").value = "C";
    requireElement<HTMLSelectElement>("target_key").value = "C";
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toContain("same");
  });

  async function submitAndWait() {
    requireElement<HTMLSelectElement>("current_key").value = "C";
    requireElement<HTMLSelectElement>("target_key").value = "D";
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await vi.waitFor(() =>
      expect(requireElement("spinner").classList.contains("hidden")).toBe(true)
    );
  }

  it("posts a single .docx to /transpose and renders the change table", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(fetch).toHaveBeenCalledWith("/transpose", expect.objectContaining({ method: "POST" }));
    expect(clickSpy).toHaveBeenCalled();
    expect(message().textContent).toContain("Transposed from C to D");
    expect(message().querySelectorAll("tbody tr")).toHaveLength(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("posts a .txt file to /transpose-text with the native text format", async () => {
    fetchMock.mockResolvedValue(
      response({ headers: { "Content-Disposition": 'attachment; filename="hymn_D.txt"' } })
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeTextFile("hymn.txt", "C G Am F")]);
    await submitAndWait();
    const [endpoint, options] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe("/transpose-text");
    expect(options.body.get("format")).toBe("txt");
  });

  it("posts a ChordPro file to /transpose-text as chordpro", async () => {
    fetchMock.mockResolvedValue(
      response({ headers: { "Content-Disposition": 'attachment; filename="grace_D.pro"' } })
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeTextFile("grace.pro", "[C]hi")]);
    await submitAndWait();
    expect(fetchMock.mock.calls[0]![1].body.get("format")).toBe("chordpro");
  });

  it("posts a text file as PDF when the pdf format is selected", async () => {
    document.querySelector<HTMLInputElement>('input[value="docx"]')!.checked = false;
    document.querySelector<HTMLInputElement>('input[value="pdf"]')!.checked = true;
    fetchMock.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeTextFile("hymn.txt", "C G")]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    expect(fetchMock.mock.calls[0]![1].body.get("format")).toBe("pdf");
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.pdf");
  });

  it("sends preview edits with a text upload, keyed by the source line", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics\nF C"));
    previewText().value = "D A Bm7 G\nlyrics\nG D";
    previewText().dispatchEvent(new Event("input"));
    await submitAndWait();
    const body = fetchMock.mock.calls[0]![1].body as FormData;
    expect(JSON.parse(body.get("edits") as string)).toEqual([
      { source: "C G Am F", text: "D A Bm7 G" },
    ]);
  });

  it("confirms the download without a change table when the preview is shown", async () => {
    fetchMock.mockResolvedValue(
      response({ headers: { "Content-Disposition": 'attachment; filename="hymn_D.txt"' } })
    );
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    await submitAndWait();
    expect(message().textContent).toBe("Transposed from C to D · downloaded hymn_D.txt");
    expect(message().querySelector("table")).toBeNull();
    expect(preview().classList.contains("hidden")).toBe(false);
  });

  it("omits the edits field when the preview was not changed", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    await submitAndWait();
    expect((fetchMock.mock.calls[0]![1].body as FormData).has("edits")).toBe(false);
  });

  it("sends .docx preview edits with the form data, keeping multi-line paragraphs together", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    await selectAndPreview(docxFile("song.docx", ["C G\nAm F", "lyrics"]));
    expect(previewText().value).toBe("D A\nBm G\nlyrics");
    previewText().value = "D A\nBm7 G\nlyrics";
    previewText().dispatchEvent(new Event("input"));
    fetchMock.mockClear();
    await submitAndWait();
    const [endpoint, options] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe("/transpose");
    expect(JSON.parse(options.body.get("edits") as string)).toEqual([
      { source: "C G\nAm F", text: "D A\nBm7 G" },
    ]);
  });

  it("sends an added preview line as part of the paragraph it follows", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics"));
    previewText().value = "D A Bm G\nlyrics\nmore lyrics";
    previewText().dispatchEvent(new Event("input"));
    await submitAndWait();
    const body = fetchMock.mock.calls[0]![1].body as FormData;
    expect(JSON.parse(body.get("edits") as string)).toEqual([
      { source: "lyrics", text: "lyrics\nmore lyrics" },
    ]);
  });

  it("sends a removed preview line as an emptied paragraph", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F\nlyrics"));
    previewText().value = "D A Bm G";
    previewText().dispatchEvent(new Event("input"));
    await submitAndWait();
    const body = fetchMock.mock.calls[0]![1].body as FormData;
    expect(JSON.parse(body.get("edits") as string)).toEqual([{ source: "lyrics", text: "" }]);
  });

  it("sends no edits when the preview could not be generated", async () => {
    fetchMock.mockResolvedValue(response());
    initUpload();
    await selectAndPreview(makeTextFile("hymn.txt", "C G Am F"));
    const currentKey = requireElement<HTMLSelectElement>("current_key");
    currentKey.value = "";
    currentKey.dispatchEvent(new Event("change"));
    requireElement<HTMLSelectElement>("current_key").value = "C";
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await vi.waitFor(() =>
      expect(requireElement("spinner").classList.contains("hidden")).toBe(true)
    );
    expect((fetchMock.mock.calls[0]![1].body as FormData).has("edits")).toBe(false);
  });

  it("posts multiple .docx files to /binder and reports the binder result", async () => {
    fetchMock.mockResolvedValue(
      response({ headers: { "Content-Disposition": 'attachment; filename="chord_binder_D.pdf"' } })
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [
      makeFile("a.docx", 1024),
      makeFile("b.docx", 1024),
    ]);
    await submitAndWait();
    const [endpoint, options] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe("/binder");
    expect(options.body.getAll("files")).toHaveLength(2);
    expect(message().textContent).toContain("Binder created from 2 files");
  });

  it("falls back to the binder filename when no disposition is present", async () => {
    fetchMock.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [
      makeFile("a.docx", 1024),
      makeFile("b.docx", 1024),
    ]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("chord_binder.pdf");
  });

  it("shows the server error message on a non-ok response", async () => {
    fetchMock.mockResolvedValue(response({ top: { ok: false }, json: { error: "Bad key." } }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Bad key.");
  });

  it("falls back to a generic error when the body is not JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      headers: { get: () => null },
      json: () => Promise.reject(new Error("nope")),
    });
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Something went wrong.");
  });

  it("uses a generic error when the error field is empty", async () => {
    fetchMock.mockResolvedValue(response({ top: { ok: false }, json: { error: "" } }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Something went wrong.");
  });

  it("uses a generic error when the JSON omits an error field", async () => {
    fetchMock.mockResolvedValue(response({ top: { ok: false }, json: {} }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Something went wrong.");
  });

  it("reports a network error when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Network error. Please try again.");
  });

  it("parses an extended UTF-8 filename", async () => {
    fetchMock.mockResolvedValue(
      response({
        headers: { "Content-Disposition": "attachment; filename*=UTF-8''caf%C3%A9.docx" },
      })
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("café.docx");
  });

  it("falls back when the extended filename cannot be decoded", async () => {
    fetchMock.mockResolvedValue(
      response({ headers: { "Content-Disposition": "attachment; filename*=UTF-8''%E0%A4%A.docx" } })
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.docx");
  });

  it("parses a bare filename and default header values", async () => {
    fetchMock.mockResolvedValue(
      response({
        headers: {
          "Content-Disposition": "attachment; filename=plain.docx",
          "X-Transpose-From": null,
          "X-Transpose-To": null,
          "X-Transpose-Changes": null,
        },
      })
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("plain.docx");
    expect(message().textContent).toContain("Transposed from ? to ?");
  });

  it("defaults to docx when no format radio is checked and no disposition", async () => {
    document.querySelector<HTMLInputElement>('input[value="docx"]')!.checked = false;
    fetchMock.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.docx");
  });

  it("falls back to the selected format when no disposition is present", async () => {
    document.querySelector<HTMLInputElement>('input[value="pdf"]')!.checked = true;
    document.querySelector<HTMLInputElement>('input[value="docx"]')!.checked = false;
    fetchMock.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.pdf");
  });
});

describe("initUpload change table", () => {
  beforeEach(() => {
    setupDom();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders an empty After cell for a malformed change entry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ headers: { "X-Transpose-Changes": "C->D, G" } }))
    );
    initUpload();
    setFiles(requireElement<HTMLInputElement>("file"), [makeFile("song.docx", 1024)]);
    requireElement<HTMLSelectElement>("current_key").value = "C";
    requireElement<HTMLSelectElement>("target_key").value = "D";
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await vi.waitFor(() =>
      expect(requireElement("spinner").classList.contains("hidden")).toBe(true)
    );
    const cells = [...requireElement("message").querySelectorAll("tbody td")].map(
      (cell) => cell.textContent
    );
    expect(cells).toEqual(["C", "D", "G", ""]);
  });
});
