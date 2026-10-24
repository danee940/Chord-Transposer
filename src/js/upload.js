import { createDetectionBadge } from "./detect-badge.js";
import { BASE_CLASSES, ERROR_CLASSES, OK_CLASSES, makeCell, makeHeaderCell } from "./dom.js";
import {
  InvalidKeyError,
  isChordProText,
  transposeChordProText,
  transposeText,
} from "./transpose/index.js";

export function initUpload() {
  const form = document.getElementById("form");
  const submit = document.getElementById("submit");
  const submitLabel = document.getElementById("submit-label");
  const spinner = document.getElementById("spinner");
  const message = document.getElementById("message");
  const fileInput = document.getElementById("file");
  const dropzone = document.getElementById("dropzone");
  const dropzoneText = document.getElementById("dropzone-text");
  const currentKey = document.getElementById("current_key");
  const targetKey = document.getElementById("target_key");
  const swap = document.getElementById("swap");
  const detectedWrap = document.getElementById("upload_detected_wrap");
  const detectedLabel = document.getElementById("upload_detected_label");
  const detectedAlt = document.getElementById("upload_detected_alt");

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  const MAX_BINDER_FILES = 20;
  const MAX_BINDER_TOTAL_BYTES = 40 * 1024 * 1024;
  const TEXT_EXTENSIONS = [".txt", ".pro", ".cho"];
  const DEFAULT_DROPZONE_HTML =
    '<span class="font-medium text-slate-800 dark:text-slate-200">Drop your chord sheets here</span> or click to browse';

  let textPreviewSource = null;

  function isTextName(name) {
    return TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
  }

  function isDocxName(name) {
    return name.toLowerCase().endsWith(".docx");
  }

  function hideMessage() {
    message.className = BASE_CLASSES + " hidden";
    message.replaceChildren();
  }

  function show(kind, text) {
    message.className = BASE_CLASSES + " " + (kind === "error" ? ERROR_CLASSES : OK_CLASSES);
    message.textContent = text;
  }

  function formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function validateFile(file) {
    if (!file) return "Please choose a file to upload.";
    if (!isDocxName(file.name) && !isTextName(file.name))
      return "Unsupported file type. Upload .docx, .txt, .pro, or .cho.";
    if (file.size === 0) return "The selected file is empty.";
    if (file.size > MAX_UPLOAD_BYTES) return "File is too large. The maximum size is 10 MB.";
    return null;
  }

  function validateFiles(files) {
    if (files.length > MAX_BINDER_FILES)
      return `Too many files. The maximum is ${MAX_BINDER_FILES}.`;
    let total = 0;
    for (const file of files) {
      if (!isDocxName(file.name)) return "The binder accepts .docx files only.";
      if (file.size === 0) return "One of the selected files is empty.";
      total += file.size;
    }
    if (total > MAX_BINDER_TOTAL_BYTES)
      return "Files are too large. The combined maximum is 40 MB.";
    return null;
  }

  function selectedFiles() {
    return [...fileInput.files];
  }

  function updateDropzone(files) {
    if (!files || files.length === 0) {
      dropzoneText.innerHTML = DEFAULT_DROPZONE_HTML;
      return;
    }
    dropzoneText.innerHTML =
      `<span class="font-medium text-slate-800 dark:text-slate-200"></span>` +
      `<span class="block text-xs text-muted-light dark:text-muted"></span>`;
    if (files.length === 1) {
      dropzoneText.firstChild.textContent = files[0].name;
      dropzoneText.lastChild.textContent = formatBytes(files[0].size);
      return;
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    dropzoneText.firstChild.textContent = `${files.length} files selected`;
    dropzoneText.lastChild.textContent = formatBytes(total);
  }

  function selectedFormat() {
    return form.querySelector('input[name="format"]:checked')?.value || "docx";
  }

  function showPreview(from, to, text) {
    message.className = BASE_CLASSES + " " + OK_CLASSES;
    message.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "mb-2 font-semibold";
    heading.textContent = `Preview: ${from} to ${to}`;
    message.appendChild(heading);

    const pre = document.createElement("pre");
    pre.className = "overflow-x-auto whitespace-pre font-mono text-xs";
    pre.textContent = text;
    message.appendChild(pre);
  }

  const detection = createDetectionBadge({
    wrap: detectedWrap,
    label: detectedLabel,
    altButton: detectedAlt,
    select: currentKey,
    onAltPick: runPreview,
  });

  let fileSelectionId = 0;

  async function detectDocxKey(file, selectionId) {
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await fetch("/detect-key", { method: "POST", body: data });
      if (!response.ok) return;
      const result = await response.json();
      if (selectionId !== fileSelectionId) return;
      detection.apply(result);
    } catch {
      return;
    }
  }

  function runPreview() {
    if (textPreviewSource === null) return;
    if (currentKey.value === targetKey.value) {
      hideMessage();
      return;
    }
    try {
      const result = isChordProText(textPreviewSource)
        ? transposeChordProText(textPreviewSource, currentKey.value, targetKey.value)
        : transposeText(textPreviewSource, currentKey.value, targetKey.value);
      showPreview(result.from, result.to, result.text);
    } catch (err) {
      if (err instanceof InvalidKeyError) show("error", err.message);
    }
  }

  fileInput.addEventListener("change", () => {
    hideMessage();
    textPreviewSource = null;
    fileSelectionId += 1;
    const selectionId = fileSelectionId;
    detection.reset();
    const files = selectedFiles();
    if (files.length === 0) {
      updateDropzone(null);
      return;
    }
    const error = files.length > 1 ? validateFiles(files) : validateFile(files[0]);
    if (error) {
      show("error", error);
      fileInput.value = "";
      updateDropzone(null);
      return;
    }
    updateDropzone(files);
    if (files.length === 1 && isTextName(files[0].name)) {
      files[0].text().then((content) => {
        if (selectionId !== fileSelectionId) return;
        textPreviewSource = content;
        detection.detect(content);
        runPreview();
      });
    } else if (files.length === 1 && isDocxName(files[0].name)) {
      detectDocxKey(files[0], selectionId);
    }
  });

  ["dragenter", "dragover"].forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add("border-accent", "bg-accent/5");
    })
  );
  ["dragleave", "dragend", "drop"].forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.remove("border-accent", "bg-accent/5");
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
    const from = currentKey.value;
    currentKey.value = targetKey.value;
    targetKey.value = from;
    runPreview();
  });

  currentKey.addEventListener("change", () => {
    detection.markUserPick();
    runPreview();
  });
  targetKey.addEventListener("change", runPreview);

  function showTransposeResult(from, to, changesRaw) {
    message.className = BASE_CLASSES + " " + OK_CLASSES;
    message.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "mb-2 font-semibold";
    heading.textContent = `Transposed from ${from} to ${to}`;
    message.appendChild(heading);

    const pairs = changesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split("->"));

    const table = document.createElement("table");
    table.className = "w-full border-collapse";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.className = "text-left opacity-60";
    headRow.appendChild(makeHeaderCell("Before", "pb-1 pr-4 font-medium"));
    headRow.appendChild(makeHeaderCell("After", "pb-1 font-medium"));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const [orig, transposed] of pairs) {
      const row = document.createElement("tr");
      row.className = "border-t border-app-ok/20";
      row.appendChild(makeCell(orig, "py-1 pr-4 font-mono"));
      row.appendChild(makeCell(transposed, "py-1 font-mono"));
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    message.appendChild(table);
  }

  function showBinderResult(count) {
    message.className = BASE_CLASSES + " " + OK_CLASSES;
    message.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "font-semibold";
    heading.textContent = `Binder created from ${count} files`;
    message.appendChild(heading);
  }

  function parseDownloadFilename(disposition, fallback) {
    const extendedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (extendedMatch) {
      try {
        return decodeURIComponent(extendedMatch[1]);
      } catch {
        return fallback;
      }
    }
    const quotedMatch = disposition.match(/filename="([^"]+)"/i);
    if (quotedMatch) {
      return quotedMatch[1];
    }
    const bareMatch = disposition.match(/filename=([^;]+)/i);
    if (bareMatch) {
      return bareMatch[1].trim();
    }
    return fallback;
  }

  function textOutputFormat(name) {
    if (selectedFormat() === "pdf") return "pdf";
    return name.toLowerCase().endsWith(".txt") ? "txt" : "chordpro";
  }

  function buildRequest(files) {
    if (files.length > 1) {
      const data = new FormData();
      data.append("current_key", currentKey.value);
      data.append("target_key", targetKey.value);
      files.forEach((file) => data.append("files", file));
      return { endpoint: "/binder", body: data, multi: true, fallback: "chord_binder.pdf" };
    }
    const file = files[0];
    if (isTextName(file.name)) {
      const format = textOutputFormat(file.name);
      const data = new FormData();
      data.append("current_key", currentKey.value);
      data.append("target_key", targetKey.value);
      data.append("file", file);
      data.append("format", format);
      const ext = format === "pdf" ? "pdf" : format === "txt" ? "txt" : "pro";
      return { endpoint: "/transpose-text", body: data, multi: false, fallback: `transposed.${ext}` };
    }
    return {
      endpoint: "/transpose",
      body: new FormData(form),
      multi: false,
      fallback: `transposed.${selectedFormat()}`,
    };
  }

  function setLoading(loading) {
    submit.disabled = loading;
    spinner.classList.toggle("hidden", !loading);
    submitLabel.textContent = loading ? "Transposing..." : "Transpose & Download";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessage();

    const files = selectedFiles();
    const fileError =
      files.length === 0
        ? "Please choose a file to upload."
        : files.length > 1
          ? validateFiles(files)
          : validateFile(files[0]);
    if (fileError) {
      show("error", fileError);
      return;
    }
    if (currentKey.value === targetKey.value) {
      show("error", "Current and desired keys are the same. Pick a different key to transpose.");
      return;
    }

    setLoading(true);

    try {
      const request = buildRequest(files);
      const response = await fetch(request.endpoint, { method: "POST", body: request.body });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Something went wrong." }));
        show("error", data.error || "Something went wrong.");
        return;
      }

      const from = decodeURIComponent(response.headers.get("X-Transpose-From") || "?");
      const to = decodeURIComponent(response.headers.get("X-Transpose-To") || "?");
      const changes = decodeURIComponent(response.headers.get("X-Transpose-Changes") || "none");

      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = parseDownloadFilename(disposition, request.fallback);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      if (request.multi) {
        showBinderResult(files.length);
      } else {
        showTransposeResult(from, to, changes);
      }
    } catch (err) {
      show("error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  });
}
