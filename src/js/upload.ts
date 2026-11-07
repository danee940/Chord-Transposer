import {
  checkBinder,
  fileKey,
  focusFileAction,
  formatBytes,
  moveItem,
  renderFileList,
  type BinderEntry,
} from "./binder-files";
import { groupChanges, renderChangeRow } from "./change-groups";
import { createChangesDisclosure } from "./changes-disclosure";
import { createDetectionBadge } from "./detect-badge";
import { extractDocxParagraphs } from "./docx-text";
import { initKeyPicker } from "./key-picker";
import { alignEditedParagraphs, lineCount, regroupLines } from "./preview-edits";
import {
  NOTICE_CLASSES,
  NOTICE_ERROR_CLASSES,
  NOTICE_OK_CLASSES,
  makeCell,
  makeHeaderCell,
  requireElement,
} from "./dom";
import { splitLineContents } from "./transpose/chords";
import {
  InvalidKeyError,
  isChordProText,
  isKeyDetection,
  transposeChordProText,
  transposeText,
  type KeyTransposition,
} from "./transpose/index";

type TextFormat = "pdf" | "txt" | "chordpro";

interface UploadRequest {
  endpoint: string;
  body: FormData;
  multi: boolean;
  fallback: string;
}

interface PreviewEdit {
  index: number;
  source: string;
  text: string;
}

interface HeldEdits {
  key: string;
  paragraphs: string[];
  changed: boolean[];
}

const PREVIEW_MIN_ROWS = 8;
const PREVIEW_MAX_ROWS = 32;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = [".txt", ".pro", ".cho"];
const TEXT_FORMAT_EXTENSIONS: Readonly<Record<TextFormat, string>> = {
  pdf: "pdf",
  txt: "txt",
  chordpro: "pro",
};
const GENERIC_ERROR = "Something went wrong.";

function isTextName(name: string): boolean {
  return TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

function isDocxName(name: string): boolean {
  return name.toLowerCase().endsWith(".docx");
}

function validateFile(file: File): string | null {
  if (!isDocxName(file.name) && !isTextName(file.name))
    return "Unsupported file type. Upload .docx, .txt, .pro, or .cho.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "File is too large. The maximum size is 10 MB.";
  return null;
}

function nativeTextFormat(name: string): TextFormat {
  return name.toLowerCase().endsWith(".txt") ? "txt" : "chordpro";
}

function originalFormatLabel(name: string): string {
  return isTextName(name) ? `.${TEXT_FORMAT_EXTENSIONS[nativeTextFormat(name)]}` : ".docx";
}

interface ErrorDetails {
  message: string;
  index: number | null;
}

function errorDetails(payload: unknown): ErrorDetails {
  const record: Record<string, unknown> =
    typeof payload === "object" && payload !== null ? { ...payload } : {};
  const { error, index } = record;
  return {
    message: typeof error === "string" && error !== "" ? error : GENERIC_ERROR,
    index: Number.isInteger(index) ? Number(index) : null,
  };
}

function parseDownloadFilename(disposition: string, fallback: string): string {
  const extended = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (extended !== undefined) {
    try {
      return decodeURIComponent(extended);
    } catch {
      return fallback;
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(disposition)?.[1];
  if (quoted !== undefined) return quoted;
  const bare = /filename=([^;]+)/i.exec(disposition)?.[1];
  if (bare !== undefined) return bare.trim();
  return fallback;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function changePairs(changesRaw: string): [string, string][] {
  return changesRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("->");
      return separator === -1
        ? [entry, ""]
        : [entry.slice(0, separator), entry.slice(separator + 2)];
    });
}

export function initUpload(): void {
  const form = requireElement<HTMLFormElement>("form");
  const submit = requireElement<HTMLButtonElement>("submit");
  const submitLabel = requireElement("submit-label");
  const spinner = requireElement("spinner");
  const message = requireElement("message");
  const fileInput = requireElement<HTMLInputElement>("file");
  const dropzone = requireElement("dropzone");
  const dropzoneText = requireElement("dropzone-text");
  const fileList = requireElement("file_list");
  const formatGroup = requireElement("format_group");
  const formatOriginal = requireElement("format_original_label");
  const formatBinderNote = requireElement("format_binder_note");
  const currentKey = requireElement<HTMLSelectElement>("current_key");
  const targetKey = requireElement<HTMLSelectElement>("target_key");
  const swap = requireElement("swap");
  const detectedWrap = requireElement("upload_detected_wrap");
  const detectedLabel = requireElement("upload_detected_label");
  const detectedAlt = requireElement("upload_detected_alt");
  const previewWrap = requireElement("upload_preview");
  const previewStatus = requireElement("upload_preview_status");
  const previewReset = requireElement<HTMLButtonElement>("upload_preview_reset");
  const previewText = requireElement<HTMLTextAreaElement>("upload_preview_text");
  const changes = createChangesDisclosure({
    wrap: requireElement("upload_changes_wrap"),
    toggle: requireElement("upload_changes_toggle"),
    label: requireElement("upload_changes_label"),
    caret: requireElement("upload_changes_caret"),
    list: requireElement("upload_changes"),
  });

  let sourceParagraphs: string[] | null = null;
  let previewParagraphs: string[] = [];
  let previewKey = "";
  let heldEdits: HeldEdits | null = null;
  let fileSelectionId = 0;
  const serverProblems = new Map<string, string>();

  function hideMessage(): void {
    message.className = "hidden";
    message.replaceChildren();
  }

  function showError(text: string): void {
    message.className = `${NOTICE_CLASSES} ${NOTICE_ERROR_CLASSES}`;
    message.textContent = text;
  }

  function showResult(headingText: string, ...details: Node[]): void {
    message.className = `${NOTICE_CLASSES} ${NOTICE_OK_CLASSES}`;
    const heading = document.createElement("div");
    heading.className = details.length > 0 ? "mb-2 font-semibold" : "font-semibold";
    heading.textContent = headingText;
    message.replaceChildren(heading, ...details);
  }

  function selectedFiles(): File[] {
    return [...fileInput.files!];
  }

  function dropzoneLine(className: string, text: string): HTMLSpanElement {
    const line = document.createElement("span");
    line.className = className;
    line.textContent = text;
    return line;
  }

  function updateDropzone(files: File[]): void {
    const [first] = files;
    if (first === undefined) {
      dropzoneText.replaceChildren(
        dropzoneLine("font-medium text-ink", "Drop your chord sheets here"),
        document.createTextNode(" or click to browse")
      );
      return;
    }
    const single = files.length === 1;
    const total = files.reduce((sum, file) => sum + file.size, 0);
    dropzoneText.replaceChildren(
      dropzoneLine("font-medium text-ink", single ? first.name : `${files.length} files selected`),
      dropzoneLine("mt-0.5 block text-xs text-graphite", formatBytes(total))
    );
  }

  function replaceFiles(files: File[]): void {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change"));
  }

  const fileListActions = {
    move(index: number, offset: -1 | 1): void {
      replaceFiles(moveItem(selectedFiles(), index, offset));
      focusFileAction(fileList, index + offset, offset < 0 ? "up" : "down");
    },
    remove(index: number): void {
      const remaining = selectedFiles().filter((_, position) => position !== index);
      replaceFiles(remaining);
      if (remaining.length > 1) {
        focusFileAction(fileList, index, "remove");
      } else {
        fileInput.focus();
      }
    },
  };

  function showBinderEntries(entries: BinderEntry[]): void {
    renderFileList(fileList, entries, fileListActions);
  }

  function serverProblem(file: File): string | null {
    return serverProblems.get(fileKey(file)) ?? null;
  }

  function flagRejectedFile(files: File[], index: number, problem: string): void {
    const rejected = files[index];
    if (rejected === undefined) return;
    serverProblems.set(fileKey(rejected), problem);
    showBinderEntries(checkBinder(files, serverProblem).entries);
  }

  function updateFormatChoice(files: File[]): void {
    const binder = files.length > 1;
    formatGroup.classList.toggle("hidden", binder);
    formatBinderNote.classList.toggle("hidden", !binder);
    formatOriginal.textContent = originalFormatLabel(files[0]?.name ?? "");
  }

  function selectedFormat(): string {
    return form.querySelector<HTMLInputElement>('input[name="format"]:checked')?.value || "docx";
  }

  function previewValue(): string {
    return previewParagraphs.join("\n");
  }

  function syncResetButton(): void {
    previewReset.classList.toggle("hidden", previewText.value === previewValue());
  }

  function hidePreview(): void {
    previewWrap.classList.add("hidden");
    previewParagraphs = [];
    previewText.value = "";
    changes.hide();
    syncResetButton();
  }

  function showPreview(result: KeyTransposition, text: string): void {
    const count = result.changes.length;
    previewStatus.textContent =
      count > 0
        ? `Preview · ${result.from} → ${result.to}`
        : `Preview · ${result.from} → ${result.to} · no chords found to change`;
    previewText.value = text;
    previewText.rows = Math.min(
      PREVIEW_MAX_ROWS,
      Math.max(PREVIEW_MIN_ROWS, lineCount(previewText.value) + 1)
    );
    if (count > 0) {
      changes.show(groupChanges(result.changes).map(renderChangeRow));
    } else {
      changes.hide();
    }
    previewWrap.classList.remove("hidden");
    syncResetButton();
  }

  const keyPicker = initKeyPicker({
    onNotationPick: () => rerunPreview(),
    panel: requireElement("key_picker"),
    title: requireElement("key_picker_title"),
    distance: requireElement("key_distance"),
    interval: requireElement("key_interval"),
    fields: [
      {
        trigger: requireElement<HTMLButtonElement>("current_key_trigger"),
        label: requireElement("current_key_label"),
        select: currentKey,
        title: "Current key",
      },
      {
        trigger: requireElement<HTMLButtonElement>("target_key_trigger"),
        label: requireElement("target_key_label"),
        select: targetKey,
        title: "Desired key",
      },
    ],
  });

  const detection = createDetectionBadge({
    wrap: detectedWrap,
    label: detectedLabel,
    altButton: detectedAlt,
    select: currentKey,
    onAltPick: rerunPreview,
    onNotation: (german) => keyPicker.setNotation(german),
  });

  async function detectDocxKey(file: File, selectionId: number): Promise<void> {
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await fetch("/detect-key", { method: "POST", body: data });
      if (!response.ok) return;
      const result: unknown = await response.json();
      if (selectionId !== fileSelectionId || !isKeyDetection(result)) return;
      detection.apply(result);
      rerunPreview();
    } catch {
      return;
    }
  }

  function transposeSheet(text: string, from: string, to: string): KeyTransposition {
    const notation = keyPicker.notationOverride();
    return isChordProText(text)
      ? transposeChordProText(text, from, to, notation)
      : transposeText(text, from, to, notation);
  }

  function editedParagraphs(): string[] {
    return alignEditedParagraphs(previewParagraphs, previewText.value);
  }

  function captureEdits(): HeldEdits | null {
    if (previewParagraphs.length === 0) return null;
    const paragraphs = editedParagraphs();
    const changed = paragraphs.map((text, index) => text !== previewParagraphs[index]);
    return changed.includes(true) ? { key: previewKey, paragraphs, changed } : null;
  }

  function rebaseHeldEdits(target: string): string[] {
    const held = heldEdits;
    heldEdits = null;
    if (held === null) return previewParagraphs;
    const rebased =
      held.key === target
        ? held.paragraphs
        : regroupLines(
            transposeSheet(held.paragraphs.join("\n"), held.key, target).text,
            held.paragraphs
          );
    return previewParagraphs.map((text, index) => (held.changed[index] ? rebased[index]! : text));
  }

  function runPreview(): void {
    keyPicker.refresh();
    if (sourceParagraphs === null) return;
    if (currentKey.value === targetKey.value) {
      hideMessage();
      hidePreview();
      return;
    }
    try {
      const result = transposeSheet(sourceParagraphs.join("\n"), currentKey.value, targetKey.value);
      previewParagraphs = regroupLines(result.text, sourceParagraphs);
      previewKey = targetKey.value;
      showPreview(result, rebaseHeldEdits(targetKey.value).join("\n"));
    } catch (err) {
      showError(err instanceof InvalidKeyError ? err.message : GENERIC_ERROR);
    }
  }

  function rerunPreview(): void {
    heldEdits = captureEdits() ?? heldEdits;
    runPreview();
  }

  function loadPreviewSource(paragraphs: string[], selectionId: number): void {
    if (selectionId !== fileSelectionId || paragraphs.length === 0) return;
    sourceParagraphs = paragraphs;
    runPreview();
  }

  function collectEdits(): PreviewEdit[] {
    if (sourceParagraphs === null || previewParagraphs.length === 0) return [];
    const edited = editedParagraphs();
    return sourceParagraphs.flatMap((source, index) =>
      edited[index] === previewParagraphs[index] ? [] : [{ index, source, text: edited[index]! }]
    );
  }

  fileInput.addEventListener("change", () => {
    hideMessage();
    hidePreview();
    sourceParagraphs = null;
    heldEdits = null;
    fileSelectionId += 1;
    const selectionId = fileSelectionId;
    detection.reset();
    const files = selectedFiles();
    const [first] = files;
    updateFormatChoice(files);
    if (files.length > 1) {
      const binder = checkBinder(files, serverProblem);
      showBinderEntries(binder.entries);
      updateDropzone(files);
      if (binder.summary !== null) showError(binder.summary);
      return;
    }
    showBinderEntries([]);
    if (first === undefined) {
      updateDropzone([]);
      return;
    }
    const error = validateFile(first);
    if (error !== null) {
      showError(error);
      fileInput.value = "";
      updateFormatChoice([]);
      updateDropzone([]);
      return;
    }
    updateDropzone(files);
    if (isTextName(first.name)) {
      void first.text().then((content) => {
        if (selectionId !== fileSelectionId) return;
        detection.detect(content);
        loadPreviewSource(splitLineContents(content), selectionId);
      });
    } else {
      void detectDocxKey(first, selectionId);
      void Promise.resolve()
        .then(() => first.arrayBuffer())
        .then(extractDocxParagraphs)
        .then((paragraphs) => loadPreviewSource(paragraphs, selectionId))
        .catch(() => undefined);
    }
  });

  previewText.addEventListener("input", syncResetButton);
  previewReset.addEventListener("click", () => {
    previewText.value = previewValue();
    syncResetButton();
    previewText.focus();
  });

  (["dragenter", "dragover"] as const).forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.dataset["dragging"] = "";
    })
  );
  (["dragleave", "dragend", "drop"] as const).forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      delete dropzone.dataset["dragging"];
    })
  );
  dropzone.addEventListener("drop", (event) => {
    const dropped = [...(event.dataTransfer?.files ?? [])];
    if (dropped.length === 0) return;
    const dataTransfer = new DataTransfer();
    dropped.forEach((file) => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event("change"));
  });

  swap.addEventListener("click", () => {
    detection.markUserPick();
    heldEdits = captureEdits() ?? heldEdits;
    const from = currentKey.value;
    currentKey.value = targetKey.value;
    targetKey.value = from;
    runPreview();
  });

  currentKey.addEventListener("change", () => {
    detection.markUserPick();
    rerunPreview();
  });
  targetKey.addEventListener("change", rerunPreview);

  function showTransposeResult(from: string, to: string, changesRaw: string): void {
    const table = document.createElement("table");
    table.className = "w-full border-collapse";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.className = "text-left text-graphite";
    headRow.appendChild(makeHeaderCell("Before", "pb-1 pr-4 font-medium"));
    headRow.appendChild(makeHeaderCell("After", "pb-1 font-medium"));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const [original, transposed] of changePairs(changesRaw)) {
      const row = document.createElement("tr");
      row.className = "border-t border-rule";
      row.appendChild(makeCell(original, "py-1 pr-4 font-mono"));
      row.appendChild(makeCell(transposed, "py-1 font-mono"));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    showResult(`Transposed from ${from} to ${to}`, table);
  }

  function textOutputFormat(name: string): TextFormat {
    return selectedFormat() === "pdf" ? "pdf" : nativeTextFormat(name);
  }

  function keyFormData(): FormData {
    const data = new FormData();
    data.append("current_key", currentKey.value);
    data.append("target_key", targetKey.value);
    return data;
  }

  function appendNotation(data: FormData): FormData {
    const notation = keyPicker.notationOverride();
    if (notation !== undefined) data.append("notation", notation ? "german" : "english");
    return data;
  }

  function appendOverrides(data: FormData, edits: PreviewEdit[]): FormData {
    appendNotation(data);
    if (edits.length > 0) data.append("edits", JSON.stringify(edits));
    return data;
  }

  function buildBinderRequest(files: File[]): UploadRequest {
    const data = keyFormData();
    files.forEach((file) => data.append("files", file));
    return {
      endpoint: "/binder",
      body: appendNotation(data),
      multi: true,
      fallback: "chord_binder.pdf",
    };
  }

  function buildSingleRequest(file: File, edits: PreviewEdit[]): UploadRequest {
    if (isTextName(file.name)) {
      const format = textOutputFormat(file.name);
      const data = keyFormData();
      data.append("file", file);
      data.append("format", format);
      return {
        endpoint: "/transpose-text",
        body: appendOverrides(data, edits),
        multi: false,
        fallback: `transposed.${TEXT_FORMAT_EXTENSIONS[format]}`,
      };
    }
    return {
      endpoint: "/transpose",
      body: appendOverrides(new FormData(form), edits),
      multi: false,
      fallback: `transposed.${selectedFormat()}`,
    };
  }

  function setLoading(loading: boolean): void {
    submit.disabled = loading;
    spinner.classList.toggle("hidden", !loading);
    submitLabel.textContent = loading ? "Transposing..." : "Transpose & Download";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const files = selectedFiles();
    const [first] = files;
    if (first === undefined) {
      showError("Please choose a file to upload.");
      return;
    }
    const fileError =
      files.length > 1 ? checkBinder(files, serverProblem).summary : validateFile(first);
    if (fileError !== null) {
      showError(fileError);
      return;
    }
    if (currentKey.value === targetKey.value) {
      showError("Current and desired keys are the same. Pick a different key to transpose.");
      return;
    }
    const edits = files.length > 1 ? [] : collectEdits();

    setLoading(true);

    try {
      const request =
        files.length > 1 ? buildBinderRequest(files) : buildSingleRequest(first, edits);
      const response = await fetch(request.endpoint, { method: "POST", body: request.body });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const details = errorDetails(payload);
        showError(details.message);
        if (request.multi && details.index !== null) {
          flagRejectedFile(files, details.index, details.message);
        }
        return;
      }

      const from = decodeURIComponent(response.headers.get("X-Transpose-From") || "?");
      const to = decodeURIComponent(response.headers.get("X-Transpose-To") || "?");
      const changes = decodeURIComponent(response.headers.get("X-Transpose-Changes") || "none");

      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = parseDownloadFilename(disposition, request.fallback);
      downloadBlob(await response.blob(), filename);

      if (request.multi) {
        showResult(`Binder created from ${files.length} files`);
      } else if (previewWrap.classList.contains("hidden")) {
        showTransposeResult(from, to, changes);
      } else {
        showResult(`Transposed from ${from} to ${to} · downloaded ${filename}`);
      }
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  });
}
