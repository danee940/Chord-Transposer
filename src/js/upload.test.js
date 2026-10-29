import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initUpload } from "./upload";

function setupDom() {
  document.body.innerHTML = `
    <form id="form">
      <input id="file" type="file" name="file" multiple />
      <div id="dropzone"><span id="dropzone-text"></span></div>
      <select id="current_key"><option value="C">C</option><option value="D">D</option></select>
      <select id="target_key"><option value="C">C</option><option value="D">D</option></select>
      <button id="swap" type="button"></button>
      <span id="upload_detected_wrap" class="hidden">
        <span id="upload_detected_label"></span>
        <button id="upload_detected_alt" type="button" class="hidden"></button>
      </span>
      <label><input type="radio" name="format" value="docx" checked /></label>
      <label><input type="radio" name="format" value="pdf" /></label>
      <button id="submit" type="submit"><span id="submit-label"></span><span id="spinner"></span></button>
      <div id="message"></div>
    </form>
  `;
}

function makeFile(name, size) {
  const file = new File(["x".repeat(Math.max(size, 0))], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function makeTextFile(name, content) {
  const file = new File([content], name);
  Object.defineProperty(file, "size", { value: content.length });
  file.text = () => Promise.resolve(content);
  return file;
}

function setFiles(input, files) {
  Object.defineProperty(input, "files", { value: files, configurable: true });
}

function response(overrides = {}) {
  return {
    ok: true,
    headers: {
      get: (name) =>
        ({
          "X-Transpose-From": "C",
          "X-Transpose-To": "D",
          "X-Transpose-Changes": "C->D, G->A",
          "Content-Disposition": 'attachment; filename="song.docx"',
          ...overrides.headers,
        })[name] ?? null,
    },
    json: async () => overrides.json ?? {},
    blob: async () => new Blob(["data"]),
    ...overrides.top,
  };
}

describe("initUpload", () => {
  let clickSpy;

  beforeEach(() => {
    setupDom();
    vi.stubGlobal("fetch", vi.fn());
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.DataTransfer = class {
      constructor() {
        this._files = [];
        this.items = { add: (file) => this._files.push(file) };
      }
      get files() {
        return this._files;
      }
    };
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function message() {
    return document.getElementById("message");
  }

  it("validates the file on change and shows the file summary", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("dropzone-text").textContent).toContain("song.docx");
  });

  it("detects the key of a text upload and preselects it", async () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(document.getElementById("upload_detected_label").textContent).toBe("Detected: D")
    );
    expect(document.getElementById("current_key").value).toBe("D");
    expect(document.getElementById("upload_detected_wrap").classList.contains("hidden")).toBe(
      false
    );
  });

  it("asks the server to detect the key of a .docx upload", async () => {
    initUpload();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: "D", alternate: null, ambiguous: false, chords: 4, distinct: 3 }),
    });
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(document.getElementById("upload_detected_label").textContent).toBe("Detected: D")
    );
    expect(fetch).toHaveBeenCalledWith("/detect-key", expect.objectContaining({ method: "POST" }));
    expect(document.getElementById("current_key").value).toBe("D");
  });

  it("ignores a failed .docx key detection response", async () => {
    initUpload();
    fetch.mockResolvedValue({ ok: false });
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(document.getElementById("current_key").value).toBe("C");
    expect(document.getElementById("upload_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("ignores a key detection network error", async () => {
    initUpload();
    fetch.mockRejectedValue(new Error("offline"));
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("song.docx", 2048)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(document.getElementById("upload_detected_wrap").classList.contains("hidden")).toBe(true);
  });

  it("discards a stale .docx detection response", async () => {
    initUpload();
    let resolveFirst;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    fetch.mockReturnValueOnce(firstResponse).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ key: "D", alternate: null, ambiguous: false, chords: 4, distinct: 3 }),
    });
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("a.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    setFiles(fileInput, [makeFile("b.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(document.getElementById("upload_detected_label").textContent).toBe("Detected: D")
    );
    resolveFirst({
      ok: true,
      json: async () => ({ key: "C", alternate: null, ambiguous: false, chords: 4, distinct: 3 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById("upload_detected_label").textContent).toBe("Detected: D");
    expect(document.getElementById("current_key").value).toBe("D");
  });

  it("discards a stale text file read after a newer selection", async () => {
    initUpload();
    const fileInput = document.getElementById("file");
    let resolveFirst;
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
      expect(document.getElementById("upload_detected_label").textContent).toBe("Detected: D")
    );
    resolveFirst("C F G7 C");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById("upload_detected_label").textContent).toBe("Detected: D");
    expect(document.getElementById("current_key").value).toBe("D");
  });

  it("skips key detection for multi-file binders", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("b.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("re-detects after a new file resets the user pick", async () => {
    initUpload();
    const currentKey = document.getElementById("current_key");
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(currentKey.value).toBe("D"));
    currentKey.value = "C";
    currentKey.dispatchEvent(new Event("change"));
    setFiles(fileInput, [makeTextFile("again.txt", "D G A7 D\nBm G A7 D")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(currentKey.value).toBe("D"));
  });

  it("accepts a .txt file and previews the transposed text", async () => {
    initUpload();
    document.getElementById("target_key").value = "D";
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "C G Am F\nlyrics here")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(message().textContent).toContain("Preview: C to D"));
    expect(message().querySelector("pre").textContent).toContain("D");
  });

  it("previews ChordPro uploads via the chordpro core", async () => {
    initUpload();
    document.getElementById("target_key").value = "D";
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeTextFile("grace.pro", "[C]Amazing [G]grace")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(message().querySelector("pre").textContent).toContain("[D]Amazing")
    );
  });

  it("hides the preview when the keys are the same", async () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "C G Am F")]);
    fileInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    expect(message().className).toContain("hidden");
  });

  it("re-runs the preview when a key changes and reports invalid keys", async () => {
    initUpload();
    document.getElementById("target_key").value = "D";
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeTextFile("hymn.txt", "C G Am F")]);
    fileInput.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(message().textContent).toContain("Preview"));

    const currentKey = document.getElementById("current_key");
    currentKey.value = "";
    currentKey.dispatchEvent(new Event("change"));
    expect(message().textContent).toContain("not a valid key");
  });

  it("rejects unsupported extensions", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("song.pdf", 500)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("Unsupported file type. Upload .docx, .txt, .pro, or .cho.");
    expect(document.getElementById("dropzone-text").innerHTML).toContain("Drop your chord sheets");
  });

  it("formats small files in KB", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("song.docx", 500)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("dropzone-text").textContent).toContain("KB");
  });

  it("shows MB sizing for larger files", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("big.docx", 3 * 1024 * 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("dropzone-text").textContent).toContain("3.0 MB");
  });

  it("rejects empty and oversized files", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("empty.docx", 0)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("The selected file is empty.");

    setFiles(fileInput, [makeFile("huge.docx", 11 * 1024 * 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("File is too large. The maximum size is 10 MB.");
  });

  it("clears the dropzone when no file is selected", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, []);
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("dropzone-text").innerHTML).toContain("Drop your chord sheets");
  });

  it("summarises a multi-file binder selection", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("b.docx", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(document.getElementById("dropzone-text").textContent).toContain("2 files selected");
  });

  it("rejects a binder containing a non-docx file", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("notes.txt", 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("The binder accepts .docx files only.");
  });

  it("rejects a binder with an empty member", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("a.docx", 1024), makeFile("b.docx", 0)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("One of the selected files is empty.");
  });

  it("rejects too many binder files", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    const many = Array.from({ length: 21 }, (_, i) => makeFile(`s${i}.docx`, 10));
    setFiles(fileInput, many);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("Too many files. The maximum is 20.");
  });

  it("rejects a binder that exceeds the combined size limit", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, [makeFile("a.docx", 30 * 1024 * 1024), makeFile("b.docx", 20 * 1024 * 1024)]);
    fileInput.dispatchEvent(new Event("change"));
    expect(message().textContent).toBe("Files are too large. The combined maximum is 40 MB.");
  });

  it("toggles the dropzone drag styling", () => {
    initUpload();
    const dropzone = document.getElementById("dropzone");
    dropzone.dispatchEvent(new Event("dragenter"));
    expect(dropzone.classList.contains("border-accent")).toBe(true);
    dropzone.dispatchEvent(new Event("dragleave"));
    expect(dropzone.classList.contains("border-accent")).toBe(false);
  });

  it("accepts dropped files", () => {
    initUpload();
    const fileInput = document.getElementById("file");
    let assigned = [];
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      get: () => assigned,
      set: (value) => {
        assigned = value;
      },
    });
    const dropzone = document.getElementById("dropzone");
    const event = new Event("drop");
    event.dataTransfer = { files: [makeFile("dropped.docx", 1024)] };
    dropzone.dispatchEvent(event);
    expect(document.getElementById("dropzone-text").textContent).toContain("dropped.docx");
  });

  it("ignores a drop with no file", () => {
    initUpload();
    const dropzone = document.getElementById("dropzone");
    const event = new Event("drop");
    event.dataTransfer = { files: [] };
    dropzone.dispatchEvent(event);
    expect(document.getElementById("dropzone-text").textContent).toBe("");
  });

  it("ignores a drop without a dataTransfer", () => {
    initUpload();
    const dropzone = document.getElementById("dropzone");
    dropzone.dispatchEvent(new Event("drop"));
    expect(document.getElementById("dropzone-text").textContent).toBe("");
  });

  it("swaps the current and target keys", () => {
    initUpload();
    document.getElementById("current_key").value = "C";
    document.getElementById("target_key").value = "D";
    document.getElementById("swap").dispatchEvent(new Event("click"));
    expect(document.getElementById("current_key").value).toBe("D");
    expect(document.getElementById("target_key").value).toBe("C");
  });

  it("blocks submission without a valid file", async () => {
    initUpload();
    const fileInput = document.getElementById("file");
    setFiles(fileInput, []);
    document.getElementById("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toBe("Please choose a file to upload.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission of an invalid single file", async () => {
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.pdf", 10)]);
    document.getElementById("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toContain("Unsupported file type");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission of an invalid binder selection", async () => {
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("a.docx", 10), makeFile("b.txt", 10)]);
    document.getElementById("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toBe("The binder accepts .docx files only.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission when the keys match", async () => {
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    document.getElementById("current_key").value = "C";
    document.getElementById("target_key").value = "C";
    document.getElementById("form").dispatchEvent(new Event("submit"));
    await Promise.resolve();
    expect(message().textContent).toContain("same");
  });

  async function submitAndWait() {
    document.getElementById("current_key").value = "C";
    document.getElementById("target_key").value = "D";
    document.getElementById("form").dispatchEvent(new Event("submit"));
    await vi.waitFor(() => expect(document.getElementById("spinner").classList.contains("hidden")).toBe(true));
  }

  it("posts a single .docx to /transpose and renders the change table", async () => {
    fetch.mockResolvedValue(response());
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(fetch).toHaveBeenCalledWith("/transpose", expect.objectContaining({ method: "POST" }));
    expect(clickSpy).toHaveBeenCalled();
    expect(message().textContent).toContain("Transposed from C to D");
    expect(message().querySelectorAll("tbody tr")).toHaveLength(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("posts a .txt file to /transpose-text with the native text format", async () => {
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": 'attachment; filename="hymn_D.txt"' } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeTextFile("hymn.txt", "C G Am F")]);
    await submitAndWait();
    const [endpoint, options] = fetch.mock.calls[0];
    expect(endpoint).toBe("/transpose-text");
    expect(options.body.get("format")).toBe("txt");
  });

  it("posts a ChordPro file to /transpose-text as chordpro", async () => {
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": 'attachment; filename="grace_D.pro"' } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeTextFile("grace.pro", "[C]hi")]);
    await submitAndWait();
    expect(fetch.mock.calls[0][1].body.get("format")).toBe("chordpro");
  });

  it("posts a text file as PDF when the pdf format is selected", async () => {
    document.querySelector('input[value="docx"]').checked = false;
    document.querySelector('input[value="pdf"]').checked = true;
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeTextFile("hymn.txt", "C G")]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    expect(fetch.mock.calls[0][1].body.get("format")).toBe("pdf");
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.pdf");
  });

  it("posts multiple .docx files to /binder and reports the binder result", async () => {
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": 'attachment; filename="chord_binder_D.pdf"' } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("a.docx", 1024), makeFile("b.docx", 1024)]);
    await submitAndWait();
    const [endpoint, options] = fetch.mock.calls[0];
    expect(endpoint).toBe("/binder");
    expect(options.body.getAll("files")).toHaveLength(2);
    expect(message().textContent).toContain("Binder created from 2 files");
  });

  it("falls back to the binder filename when no disposition is present", async () => {
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("a.docx", 1024), makeFile("b.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("chord_binder.pdf");
  });

  it("shows the server error message on a non-ok response", async () => {
    fetch.mockResolvedValue(response({ top: { ok: false }, json: { error: "Bad key." } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Bad key.");
  });

  it("falls back to a generic error when the body is not JSON", async () => {
    fetch.mockResolvedValue({
      ok: false,
      headers: { get: () => null },
      json: () => Promise.reject(new Error("nope")),
    });
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Something went wrong.");
  });

  it("uses a generic error when the JSON omits an error field", async () => {
    fetch.mockResolvedValue(response({ top: { ok: false }, json: {} }));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Something went wrong.");
  });

  it("reports a network error when fetch rejects", async () => {
    fetch.mockRejectedValue(new Error("offline"));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    await submitAndWait();
    expect(message().textContent).toBe("Network error. Please try again.");
  });

  it("parses an extended UTF-8 filename", async () => {
    fetch.mockResolvedValue(
      response({ headers: { "Content-Disposition": "attachment; filename*=UTF-8''caf%C3%A9.docx" } })
    );
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("café.docx");
  });

  it("falls back when the extended filename cannot be decoded", async () => {
    fetch.mockResolvedValue(
      response({ headers: { "Content-Disposition": "attachment; filename*=UTF-8''%E0%A4%A.docx" } })
    );
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.docx");
  });

  it("parses a bare filename and default header values", async () => {
    fetch.mockResolvedValue(
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
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("plain.docx");
    expect(message().textContent).toContain("Transposed from ? to ?");
  });

  it("defaults to docx when no format radio is checked and no disposition", async () => {
    document.querySelector('input[value="docx"]').checked = false;
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.docx");
  });

  it("falls back to the selected format when no disposition is present", async () => {
    document.querySelector('input[value="pdf"]').checked = true;
    document.querySelector('input[value="docx"]').checked = false;
    fetch.mockResolvedValue(response({ headers: { "Content-Disposition": null } }));
    initUpload();
    setFiles(document.getElementById("file"), [makeFile("song.docx", 1024)]);
    const anchorSpy = vi.spyOn(document, "createElement");
    await submitAndWait();
    const anchor = anchorSpy.mock.results.map((r) => r.value).find((el) => el.tagName === "A");
    expect(anchor.download).toBe("transposed.pdf");
  });
});
