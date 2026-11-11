import { groupChanges, renderChangeRow } from "./change-groups";
import type { ChangesDisclosure } from "./changes-disclosure";
import { alignEditedParagraphs, lineCount, regroupLines } from "./preview-edits";
import { GENERIC_ERROR } from "./upload-download";
import { InvalidKeyError, type KeyTransposition } from "./transpose/index";

const PREVIEW_MIN_ROWS = 8;
const PREVIEW_MAX_ROWS = 32;

export interface PreviewEdit {
  index: number;
  source: string;
  text: string;
}

interface HeldEdits {
  key: string;
  paragraphs: string[];
  changed: boolean[];
}

export interface PreviewElements {
  wrap: HTMLElement;
  status: HTMLElement;
  reset: HTMLButtonElement;
  text: HTMLTextAreaElement;
}

export interface PreviewOptions {
  elements: PreviewElements;
  changes: ChangesDisclosure;
  getKeys(): { from: string; to: string };
  getSelectionId(): number;
  transposeSheet(text: string, from: string, to: string): KeyTransposition;
  beforeRun(): void;
  onError(message: string): void;
  hideNotice(): void;
}

export interface UploadPreview {
  reset(): void;
  loadSource(paragraphs: string[], selectionId: number): void;
  run(): void;
  rerun(): void;
  hold(): void;
  collectEdits(): PreviewEdit[];
  restore(): void;
  syncResetButton(): void;
  isHidden(): boolean;
}

export function createUploadPreview({
  elements,
  changes,
  getKeys,
  getSelectionId,
  transposeSheet,
  beforeRun,
  onError,
  hideNotice,
}: PreviewOptions): UploadPreview {
  const { wrap, status, reset, text: textArea } = elements;

  let sourceParagraphs: string[] | null = null;
  let previewParagraphs: string[] = [];
  let previewKey = "";
  let heldEdits: HeldEdits | null = null;

  function previewValue(): string {
    return previewParagraphs.join("\n");
  }

  function syncResetButton(): void {
    reset.classList.toggle("hidden", textArea.value === previewValue());
  }

  function hide(): void {
    wrap.classList.add("hidden");
    previewParagraphs = [];
    textArea.value = "";
    changes.hide();
    syncResetButton();
  }

  function show(result: KeyTransposition, value: string): void {
    const count = result.changes.length;
    status.textContent =
      count > 0
        ? `Preview · ${result.from} → ${result.to}`
        : `Preview · ${result.from} → ${result.to} · no chords found to change`;
    textArea.value = value;
    textArea.rows = Math.min(
      PREVIEW_MAX_ROWS,
      Math.max(PREVIEW_MIN_ROWS, lineCount(textArea.value) + 1)
    );
    if (count > 0) {
      changes.show(groupChanges(result.changes).map(renderChangeRow));
    } else {
      changes.hide();
    }
    wrap.classList.remove("hidden");
    syncResetButton();
  }

  function editedParagraphs(): string[] {
    return alignEditedParagraphs(previewParagraphs, textArea.value);
  }

  function captureEdits(): HeldEdits | null {
    if (previewParagraphs.length === 0) return null;
    const paragraphs = editedParagraphs();
    const changed = paragraphs.map((value, index) => value !== previewParagraphs[index]);
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
    return previewParagraphs.map((value, index) => (held.changed[index] ? rebased[index]! : value));
  }

  function run(): void {
    beforeRun();
    if (sourceParagraphs === null) return;
    const { from, to } = getKeys();
    if (from === to) {
      hideNotice();
      hide();
      return;
    }
    try {
      const result = transposeSheet(sourceParagraphs.join("\n"), from, to);
      previewParagraphs = regroupLines(result.text, sourceParagraphs);
      previewKey = to;
      show(result, rebaseHeldEdits(to).join("\n"));
    } catch (err) {
      onError(err instanceof InvalidKeyError ? err.message : GENERIC_ERROR);
    }
  }

  function hold(): void {
    heldEdits = captureEdits() ?? heldEdits;
  }

  return {
    reset(): void {
      hide();
      sourceParagraphs = null;
      heldEdits = null;
    },
    loadSource(paragraphs: string[], selectionId: number): void {
      if (selectionId !== getSelectionId() || paragraphs.length === 0) return;
      sourceParagraphs = paragraphs;
      run();
    },
    run,
    rerun(): void {
      hold();
      run();
    },
    hold,
    collectEdits(): PreviewEdit[] {
      if (sourceParagraphs === null || previewParagraphs.length === 0) return [];
      const edited = editedParagraphs();
      return sourceParagraphs.flatMap((source, index) =>
        edited[index] === previewParagraphs[index] ? [] : [{ index, source, text: edited[index]! }]
      );
    },
    restore(): void {
      textArea.value = previewValue();
      syncResetButton();
      textArea.focus();
    },
    syncResetButton,
    isHidden(): boolean {
      return wrap.classList.contains("hidden");
    },
  };
}
