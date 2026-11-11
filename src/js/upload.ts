import {
  checkBinder,
  fileKey,
  focusFileAction,
  moveItem,
  renderFileList,
  type BinderEntry,
} from "./binder-files";
import { createChangesDisclosure } from "./changes-disclosure";
import { createDetectionBadge } from "./detect-badge";
import { extractDocxParagraphs } from "./docx-text";
import { requireElement } from "./dom";
import { initKeyPicker } from "./key-picker";
import { splitLineContents } from "./transpose/chords";
import {
  isChordProText,
  isKeyDetection,
  transposeChordProText,
  transposeText,
  type KeyTransposition,
} from "./transpose/index";
import { downloadBlob, errorDetails, parseDownloadFilename } from "./upload-download";
import { createDropzone } from "./upload-dropzone";
import { isTextName, originalFormatLabel, validateFile } from "./upload-files";
import { createNotice } from "./upload-notice";
import { createUploadPreview } from "./upload-preview";
import { buildBinderRequest, buildSingleRequest, type RequestContext } from "./upload-requests";

export function initUpload(): void {
  const form = requireElement<HTMLFormElement>("form");
  const submit = requireElement<HTMLButtonElement>("submit");
  const submitLabel = requireElement("submit-label");
  const spinner = requireElement("spinner");
  const fileInput = requireElement<HTMLInputElement>("file");
  const fileList = requireElement("file_list");
  const formatGroup = requireElement("format_group");
  const formatOriginal = requireElement("format_original_label");
  const formatBinderNote = requireElement("format_binder_note");
  const currentKey = requireElement<HTMLSelectElement>("current_key");
  const targetKey = requireElement<HTMLSelectElement>("target_key");
  const swap = requireElement("swap");
  const previewText = requireElement<HTMLTextAreaElement>("upload_preview_text");
  const previewReset = requireElement<HTMLButtonElement>("upload_preview_reset");

  const notice = createNotice(requireElement("message"));
  const dropzone = createDropzone({
    fileInput,
    dropzone: requireElement("dropzone"),
    dropzoneText: requireElement("dropzone-text"),
  });

  let fileSelectionId = 0;
  const serverProblems = new Map<string, string>();

  const fileListActions = {
    move(index: number, offset: -1 | 1): void {
      dropzone.replaceFiles(moveItem(dropzone.selectedFiles(), index, offset));
      focusFileAction(fileList, index + offset, offset < 0 ? "up" : "down");
    },
    remove(index: number): void {
      const remaining = dropzone.selectedFiles().filter((_, position) => position !== index);
      dropzone.replaceFiles(remaining);
      if (remaining.length > 1) {
        focusFileAction(fileList, index, "remove");
      } else {
        dropzone.focusInput();
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

  function transposeSheet(text: string, from: string, to: string): KeyTransposition {
    const notation = keyPicker.notationOverride();
    return isChordProText(text)
      ? transposeChordProText(text, from, to, notation)
      : transposeText(text, from, to, notation);
  }

  const preview = createUploadPreview({
    elements: {
      wrap: requireElement("upload_preview"),
      status: requireElement("upload_preview_status"),
      reset: previewReset,
      text: previewText,
    },
    changes: createChangesDisclosure({
      wrap: requireElement("upload_changes_wrap"),
      toggle: requireElement("upload_changes_toggle"),
      label: requireElement("upload_changes_label"),
      caret: requireElement("upload_changes_caret"),
      list: requireElement("upload_changes"),
    }),
    getKeys: () => ({ from: currentKey.value, to: targetKey.value }),
    getSelectionId: () => fileSelectionId,
    transposeSheet,
    beforeRun: () => keyPicker.refresh(),
    onError: (text) => notice.error(text),
    hideNotice: () => notice.hide(),
  });

  const keyPicker = initKeyPicker({
    onNotationPick: () => preview.rerun(),
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
    wrap: requireElement("upload_detected_wrap"),
    label: requireElement("upload_detected_label"),
    altButton: requireElement("upload_detected_alt"),
    select: currentKey,
    onAltPick: () => preview.rerun(),
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
      preview.rerun();
    } catch {
      return;
    }
  }

  function requestContext(): RequestContext {
    return {
      form,
      from: currentKey.value,
      to: targetKey.value,
      notation: keyPicker.notationOverride(),
      format: selectedFormat(),
    };
  }

  fileInput.addEventListener("change", () => {
    notice.hide();
    preview.reset();
    fileSelectionId += 1;
    const selectionId = fileSelectionId;
    detection.reset();
    const files = dropzone.selectedFiles();
    const [first] = files;
    updateFormatChoice(files);
    if (files.length > 1) {
      const binder = checkBinder(files, serverProblem);
      showBinderEntries(binder.entries);
      dropzone.update(files);
      if (binder.summary !== null) notice.error(binder.summary);
      return;
    }
    showBinderEntries([]);
    if (first === undefined) {
      dropzone.update([]);
      return;
    }
    const error = validateFile(first);
    if (error !== null) {
      notice.error(error);
      dropzone.clear();
      updateFormatChoice([]);
      dropzone.update([]);
      return;
    }
    dropzone.update(files);
    if (isTextName(first.name)) {
      void first.text().then((content) => {
        if (selectionId !== fileSelectionId) return;
        detection.detect(content);
        preview.loadSource(splitLineContents(content), selectionId);
      });
    } else {
      void detectDocxKey(first, selectionId);
      void Promise.resolve()
        .then(() => first.arrayBuffer())
        .then(extractDocxParagraphs)
        .then((paragraphs) => preview.loadSource(paragraphs, selectionId))
        .catch(() => undefined);
    }
  });

  previewText.addEventListener("input", () => preview.syncResetButton());
  previewReset.addEventListener("click", () => preview.restore());

  swap.addEventListener("click", () => {
    detection.markUserPick();
    preview.hold();
    const from = currentKey.value;
    currentKey.value = targetKey.value;
    targetKey.value = from;
    preview.run();
  });

  currentKey.addEventListener("change", () => {
    detection.markUserPick();
    preview.rerun();
  });
  targetKey.addEventListener("change", () => preview.rerun());

  function setLoading(loading: boolean): void {
    submit.disabled = loading;
    spinner.classList.toggle("hidden", !loading);
    submitLabel.textContent = loading ? "Transposing..." : "Transpose & Download";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.hide();

    const files = dropzone.selectedFiles();
    const [first] = files;
    if (first === undefined) {
      notice.error("Please choose a file to upload.");
      return;
    }
    const fileError =
      files.length > 1 ? checkBinder(files, serverProblem).summary : validateFile(first);
    if (fileError !== null) {
      notice.error(fileError);
      return;
    }
    if (currentKey.value === targetKey.value) {
      notice.error("Current and desired keys are the same. Pick a different key to transpose.");
      return;
    }
    const edits = files.length > 1 ? [] : preview.collectEdits();

    setLoading(true);

    try {
      const context = requestContext();
      const request =
        files.length > 1
          ? buildBinderRequest(files, context)
          : buildSingleRequest(first, edits, context);
      const response = await fetch(request.endpoint, { method: "POST", body: request.body });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const details = errorDetails(payload);
        notice.error(details.message);
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
        notice.result(`Binder created from ${files.length} files`);
      } else if (preview.isHidden()) {
        notice.transposeResult(from, to, changes);
      } else {
        notice.result(`Transposed from ${from} to ${to} · downloaded ${filename}`);
      }
    } catch {
      notice.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  });
}
