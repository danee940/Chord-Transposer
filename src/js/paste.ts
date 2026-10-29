import { formatCapoSuggestion } from "./capo-suggest";
import { createDetectionBadge } from "./detect-badge";
import { initDiagrams } from "./diagrams/index";
import type { Instrument } from "./diagrams/shapes";
import { MODE_ACTIVE_CLASSES, MODE_INACTIVE_CLASSES, requireElement, requireSelector } from "./dom";
import { loadPrefs, savePrefs } from "./prefs";
import { createStageView } from "./stage";
import {
  chordProToPlain,
  InvalidKeyError,
  isChordProText,
  textToNashville,
  transposeChordProText,
  transposeChordProTextBySemitones,
  transposeText,
  transposeTextBySemitones,
  type Change,
} from "./transpose/index";

const TRANSPOSE_MODES = ["key", "semitone", "nashville"] as const;

type TransposeMode = (typeof TRANSPOSE_MODES)[number];
type Notation = "sharp" | "flat";
type OutputFormat = "chordpro" | "plain";

interface ChangePair {
  from: string;
  to: string;
}

interface ResultBase {
  text: string;
  format?: "chordpro";
}

interface NashvilleResult extends ResultBase {
  tonic: string;
}

interface SemitoneResult extends ResultBase {
  semitones: number;
  label: string;
  notation: Notation;
  changes: ChangePair[];
}

interface KeyResult extends ResultBase {
  from: string;
  to: string;
  changes: ChangePair[];
}

type PasteResult = NashvilleResult | SemitoneResult | KeyResult;

function isTransposeMode(value: unknown): value is TransposeMode {
  return (TRANSPOSE_MODES as readonly unknown[]).includes(value);
}

function semitoneLabel(count: number, useFlats: boolean): string {
  const accidental = useFlats ? "♭" : "♯";
  const sign = count > 0 ? "+" : "−";
  const magnitude = Math.abs(count);
  const unit = magnitude === 1 ? "semitone" : "semitones";
  return `${sign}${magnitude} ${unit} (${accidental})`;
}

function mapChanges(changes: Change[]): ChangePair[] {
  return changes.map(([from, to]) => ({ from, to }));
}

export function initPaste(): void {
  const textInput = requireElement<HTMLTextAreaElement>("text_input");
  const textOutput = requireElement("text_output");
  const textStatus = requireElement("text_status");
  const textCopy = requireElement<HTMLButtonElement>("text_copy");
  const textCurrentKey = requireElement<HTMLSelectElement>("text_current_key");
  const textTargetKey = requireElement<HTMLSelectElement>("text_target_key");
  const textSwap = requireElement("text_swap");
  const textLineCount = requireElement("text_linecount");
  const textSample = requireElement("text_sample");
  const textClear = requireElement("text_clear");
  const textDetectedWrap = requireElement("text_detected_wrap");
  const textDetectedLabel = requireElement("text_detected_label");
  const textDetectedAlt = requireElement("text_detected_alt");

  const modeKey = requireElement("mode-key");
  const modeSemitone = requireElement("mode-semitone");
  const modeNashville = requireElement("mode-nashville");
  const controlsKey = requireElement("controls-key");
  const controlsSemitone = requireElement("controls-semitone");
  const textCurrentKeyLabel = requireSelector<HTMLLabelElement>('label[for="text_current_key"]');
  const chordproFormatToggle = requireElement("chordpro-format-toggle");
  const formatChordpro = requireElement("format_chordpro");
  const formatPlain = requireElement("format_plain");
  const semitoneValue = requireElement("semitone_value");
  const semitoneDown = requireElement("semitone_down");
  const semitoneUp = requireElement("semitone_up");
  const semitoneQuick = document.querySelectorAll<HTMLElement>(".semitone-quick");
  const notationSharp = requireElement("notation_sharp");
  const notationFlat = requireElement("notation_flat");
  const textInstrument = requireElement<HTMLSelectElement>("text_instrument");
  const textStage = requireElement<HTMLButtonElement>("text_stage");
  const capoSuggestion = requireElement("capo-suggestion");
  const textChanges = requireElement("text_changes");
  const textChangesWrap = requireElement("text_changes_wrap");
  const textChangesToggle = requireElement("text_changes_toggle");
  const textChangesLabel = requireElement("text_changes_label");
  const textChangesCaret = requireElement("text_changes_caret");

  const stageView = createStageView();

  const panelPaste = requireElement("panel-paste");
  const MAX_SEMITONES = parseInt(panelPaste.dataset.maxSemitones!, 10);
  const diagrams = initDiagrams(() => instrument);

  function applyPreselect(select: HTMLSelectElement, value: string | undefined): void {
    if (value && [...select.options].some((option) => option.value === value)) {
      select.value = value;
    }
  }
  applyPreselect(textCurrentKey, panelPaste.dataset.preselectFrom);
  applyPreselect(textTargetKey, panelPaste.dataset.preselectTo);
  const SAMPLE_CHORDS =
    " G      G7         C         G\n" +
    "Amazing grace, how sweet the sound\n" +
    "     G       Em          D7\n" +
    "That saved a wretch like me";

  let transposeMode: TransposeMode = "key";
  let semitones = 0;
  let useFlats = false;
  let outputFormat: OutputFormat = "chordpro";
  let instrument: Instrument = "guitar";
  let transposeTimer: ReturnType<typeof setTimeout> | undefined;
  let chosenCurrentKey = textCurrentKey.value;

  function rememberCurrentKey(): void {
    chosenCurrentKey = textCurrentKey.value;
  }

  function outputText(): string {
    return textOutput.textContent!;
  }

  function persistPrefs(): void {
    savePrefs({
      mode: transposeMode,
      currentKey: chosenCurrentKey,
      targetKey: textTargetKey.value,
      semitones,
      notation: useFlats ? "flat" : "sharp",
      instrument,
    });
  }

  function setTextStatus(text: string): void {
    textStatus.textContent = text;
  }

  function updateCapoSuggestion(): void {
    const showCapo = transposeMode === "key" && instrument === "guitar";
    const message = showCapo ? formatCapoSuggestion(textTargetKey.value) : null;
    if (message && outputText().trim()) {
      capoSuggestion.textContent = message;
      capoSuggestion.classList.remove("hidden");
    } else {
      capoSuggestion.textContent = "";
      capoSuggestion.classList.add("hidden");
    }
  }

  function updateLineCount(): void {
    const value = textInput.value;
    const lines = value === "" ? 0 : value.split("\n").length;
    textLineCount.textContent = `${lines} line${lines === 1 ? "" : "s"}`;
  }

  function setModeButtonState(button: HTMLElement, active: boolean): void {
    button.setAttribute("aria-selected", String(active));
    button.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    button.classList.add(...(active ? MODE_ACTIVE_CLASSES : MODE_INACTIVE_CLASSES));
  }

  function selectMode(mode: TransposeMode): void {
    transposeMode = mode;
    const key = mode === "key";
    const nashville = mode === "nashville";
    const showKeyControls = key || nashville;

    controlsKey.classList.toggle("hidden", !showKeyControls);
    controlsSemitone.classList.toggle("hidden", mode !== "semitone");

    textTargetKey.parentElement!.classList.toggle("hidden", nashville);
    textSwap.classList.toggle("hidden", nashville);
    textCurrentKeyLabel.textContent = nashville ? "Tonic key" : "Current key";

    setModeButtonState(modeKey, key);
    setModeButtonState(modeSemitone, mode === "semitone");
    setModeButtonState(modeNashville, nashville);

    if (nashville) {
      chordproFormatToggle.classList.add("hidden");
    }
    runTextTranspose();
    persistPrefs();
  }

  function updateSemitoneDisplay(): void {
    semitoneValue.textContent = semitones > 0 ? `+${semitones}` : String(semitones);
  }

  function setSemitones(value: number): void {
    semitones = Math.max(-MAX_SEMITONES, Math.min(MAX_SEMITONES, value));
    updateSemitoneDisplay();
    runTextTranspose();
    persistPrefs();
  }

  function selectNotation(flat: boolean): void {
    useFlats = flat;
    notationSharp.setAttribute("aria-pressed", String(!flat));
    notationFlat.setAttribute("aria-pressed", String(flat));
    notationSharp.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    notationFlat.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    notationSharp.classList.add(...(flat ? MODE_INACTIVE_CLASSES : MODE_ACTIVE_CLASSES));
    notationFlat.classList.add(...(flat ? MODE_ACTIVE_CLASSES : MODE_INACTIVE_CLASSES));
    runTextTranspose();
    persistPrefs();
  }

  function selectOutputFormat(plain: boolean): void {
    outputFormat = plain ? "plain" : "chordpro";
    formatChordpro.setAttribute("aria-pressed", String(!plain));
    formatPlain.setAttribute("aria-pressed", String(plain));
    formatChordpro.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    formatPlain.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    formatChordpro.classList.add(...(plain ? MODE_INACTIVE_CLASSES : MODE_ACTIVE_CLASSES));
    formatPlain.classList.add(...(plain ? MODE_ACTIVE_CLASSES : MODE_INACTIVE_CLASSES));
    runTextTranspose();
  }

  function maybePlain(text: string): string {
    return outputFormat === "plain" ? chordProToPlain(text) : text;
  }

  function computeResult(text: string): PasteResult {
    if (transposeMode === "nashville") {
      const result = textToNashville(text, textCurrentKey.value);
      return { text: result.text, tonic: result.tonic };
    }

    const chordpro = isChordProText(text);

    if (transposeMode === "semitone") {
      const result = chordpro
        ? transposeChordProTextBySemitones(text, semitones, useFlats)
        : transposeTextBySemitones(text, semitones, useFlats);
      const data: SemitoneResult = {
        text: chordpro ? maybePlain(result.text) : result.text,
        semitones,
        label: semitoneLabel(semitones, useFlats),
        notation: useFlats ? "flat" : "sharp",
        changes: mapChanges(result.changes),
      };
      if (chordpro) data.format = "chordpro";
      return data;
    }

    const result = chordpro
      ? transposeChordProText(text, textCurrentKey.value, textTargetKey.value)
      : transposeText(text, textCurrentKey.value, textTargetKey.value);
    const data: KeyResult = {
      text: chordpro ? maybePlain(result.text) : result.text,
      from: result.from,
      to: result.to,
      changes: mapChanges(result.changes),
    };
    if (chordpro) data.format = "chordpro";
    return data;
  }

  function summariseResult(data: PasteResult): string {
    if ("tonic" in data) {
      return `Nashville · key of ${data.tonic}`;
    }
    const count = data.changes.length;
    const label = "label" in data ? data.label : `${data.from} → ${data.to}`;
    return count > 0
      ? `${label} · ${count} chord${count === 1 ? "" : "s"} changed`
      : `${label} · no chords found to change`;
  }

  let changesCount = 0;

  function changesLabel(action: string): string {
    return `${action} ${changesCount} chord change${changesCount === 1 ? "" : "s"}`;
  }

  function collapseChanges(): void {
    textChanges.classList.add("hidden");
    textChangesToggle.setAttribute("aria-expanded", "false");
    textChangesCaret.classList.remove("rotate-90");
    textChangesLabel.textContent = changesLabel("Show");
  }

  function expandChanges(): void {
    textChanges.classList.remove("hidden");
    textChangesToggle.setAttribute("aria-expanded", "true");
    textChangesCaret.classList.add("rotate-90");
    textChangesLabel.textContent = changesLabel("Hide");
  }

  function hideChanges(): void {
    textChanges.replaceChildren();
    textChangesWrap.classList.add("hidden");
    collapseChanges();
  }

  function renderChanges(data: PasteResult): void {
    const changes = "changes" in data ? data.changes : [];
    if (changes.length === 0) {
      hideChanges();
      return;
    }
    const pills: HTMLSpanElement[] = [];
    for (const { from, to } of changes) {
      const pill = document.createElement("span");
      pill.className =
        "rounded-full border border-app-border-light bg-bg-light px-2 py-0.5 font-mono text-slate-700 dark:border-app-border dark:bg-bg dark:text-slate-200";
      pill.textContent = `${from} → ${to}`;
      pills.push(pill);
    }
    textChanges.replaceChildren(...pills);
    changesCount = pills.length;
    textChangesWrap.classList.remove("hidden");
    collapseChanges();
  }

  function syncOutputControls(): void {
    textStage.disabled = !outputText().trim();
    updateCapoSuggestion();
  }

  function runTextTranspose(): void {
    const text = textInput.value;
    if (!text.trim()) {
      textOutput.textContent = "";
      textCopy.disabled = true;
      setTextStatus("");
      chordproFormatToggle.classList.add("hidden");
      hideChanges();
      syncOutputControls();
      return;
    }
    if (transposeMode === "key" && textCurrentKey.value === textTargetKey.value) {
      setTextStatus("Pick two different keys to transpose.");
      hideChanges();
      syncOutputControls();
      return;
    }
    if (transposeMode === "semitone" && semitones === 0) {
      diagrams.renderInto(textOutput, text);
      textCopy.disabled = !text;
      setTextStatus("No shift · pick a semitone offset to transpose.");
      hideChanges();
      syncOutputControls();
      return;
    }

    try {
      const data = computeResult(text);
      const isChordPro = data.format === "chordpro" && transposeMode !== "nashville";
      chordproFormatToggle.classList.toggle("hidden", !isChordPro);

      diagrams.renderInto(textOutput, data.text);
      textCopy.disabled = !data.text;
      setTextStatus(summariseResult(data));
      renderChanges(data);
    } catch (error) {
      hideChanges();
      if (error instanceof InvalidKeyError) {
        setTextStatus(error.message);
      } else {
        setTextStatus("Something went wrong.");
      }
    }
    syncOutputControls();
  }

  const detection = createDetectionBadge({
    wrap: textDetectedWrap,
    label: textDetectedLabel,
    altButton: textDetectedAlt,
    select: textCurrentKey,
    onAltPick: () => {
      rememberCurrentKey();
      runTextTranspose();
      persistPrefs();
    },
  });
  if (panelPaste.dataset.preselectFrom) {
    detection.markUserPick();
  }

  function scheduleTextTranspose(): void {
    clearTimeout(transposeTimer);
    transposeTimer = setTimeout(() => {
      detection.detect(textInput.value);
      runTextTranspose();
    }, 250);
  }

  textInput.addEventListener("input", () => {
    updateLineCount();
    scheduleTextTranspose();
  });
  textCurrentKey.addEventListener("change", () => {
    detection.markUserPick();
    rememberCurrentKey();
    runTextTranspose();
    persistPrefs();
  });
  textTargetKey.addEventListener("change", () => {
    runTextTranspose();
    persistPrefs();
  });

  textSwap.addEventListener("click", () => {
    detection.markUserPick();
    const from = textCurrentKey.value;
    textCurrentKey.value = textTargetKey.value;
    textTargetKey.value = from;
    rememberCurrentKey();
    runTextTranspose();
    persistPrefs();
  });

  textInstrument.addEventListener("change", () => {
    instrument = textInstrument.value as Instrument;
    diagrams.closePopover();
    updateCapoSuggestion();
    persistPrefs();
  });

  textChangesToggle.addEventListener("click", () => {
    if (textChanges.classList.contains("hidden")) {
      expandChanges();
    } else {
      collapseChanges();
    }
  });

  textStage.addEventListener("click", () => {
    if (!outputText().trim()) return;
    stageView.open(outputText());
  });

  textSample.addEventListener("click", () => {
    textInput.value = SAMPLE_CHORDS;
    updateLineCount();
    detection.reset();
    detection.detect(textInput.value);
    runTextTranspose();
    textInput.focus();
  });

  textClear.addEventListener("click", () => {
    textInput.value = "";
    updateLineCount();
    detection.reset();
    runTextTranspose();
    textInput.focus();
  });

  modeKey.addEventListener("click", () => selectMode("key"));
  modeSemitone.addEventListener("click", () => selectMode("semitone"));
  modeNashville.addEventListener("click", () => selectMode("nashville"));
  formatChordpro.addEventListener("click", () => selectOutputFormat(false));
  formatPlain.addEventListener("click", () => selectOutputFormat(true));
  semitoneDown.addEventListener("click", () => setSemitones(semitones - 1));
  semitoneUp.addEventListener("click", () => setSemitones(semitones + 1));
  semitoneQuick.forEach((button) =>
    button.addEventListener("click", () => setSemitones(Number(button.dataset.semitone)))
  );
  notationSharp.addEventListener("click", () => selectNotation(false));
  notationFlat.addEventListener("click", () => selectNotation(true));

  document.addEventListener("keydown", (event) => {
    if (transposeMode !== "semitone") return;
    const target = event.target as HTMLElement | null;
    const typing =
      target &&
      (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT");
    if (typing) return;
    if (event.key === "[") {
      event.preventDefault();
      setSemitones(semitones - 1);
    } else if (event.key === "]") {
      event.preventDefault();
      setSemitones(semitones + 1);
    }
  });

  const savedPrefs = loadPrefs();
  if (!panelPaste.dataset.preselectFrom && savedPrefs.currentKey) {
    textCurrentKey.value = String(savedPrefs.currentKey);
  }
  if (!panelPaste.dataset.preselectTo && savedPrefs.targetKey) {
    textTargetKey.value = String(savedPrefs.targetKey);
  }
  const pageInstrument = panelPaste.dataset.instrument;
  if (pageInstrument) {
    instrument = pageInstrument as Instrument;
  } else if (savedPrefs.instrument) {
    instrument = savedPrefs.instrument as Instrument;
  }
  textInstrument.value = instrument;
  if (typeof savedPrefs.semitones === "number") {
    semitones = Math.max(-MAX_SEMITONES, Math.min(MAX_SEMITONES, savedPrefs.semitones));
  }

  rememberCurrentKey();

  selectOutputFormat(false);
  selectNotation(savedPrefs.notation === "flat");
  updateSemitoneDisplay();
  detection.detect(textInput.value);
  selectMode(isTransposeMode(savedPrefs.mode) ? savedPrefs.mode : "key");
  updateLineCount();

  textCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(outputText());
      const original = textCopy.textContent;
      textCopy.textContent = "Copied";
      setTimeout(() => {
        textCopy.textContent = original;
      }, 1500);
    } catch {
      setTextStatus("Could not copy to clipboard.");
    }
  });
}
