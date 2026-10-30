import { formatCapoSuggestion } from "./capo-suggest";
import { createChangesDisclosure } from "./changes-disclosure";
import { createDetectionBadge } from "./detect-badge";
import { initDiagrams } from "./diagrams/index";
import { isInstrument, type Instrument } from "./diagrams/shapes";
import {
  MODE_ACTIVE_CLASSES,
  MODE_INACTIVE_CLASSES,
  pluralise,
  requireElement,
  requireSelector,
} from "./dom";
import { initKeyPicker } from "./key-picker";
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
const DEFAULT_INSTRUMENT: Instrument = "guitar";
const TRANSPOSE_DEBOUNCE_MS = 250;
const COPIED_FEEDBACK_MS = 1500;

type TransposeMode = (typeof TRANSPOSE_MODES)[number];
type OutputFormat = "chordpro" | "plain";

interface ChangePair {
  from: string;
  to: string;
}

interface NashvilleResult {
  kind: "nashville";
  text: string;
  tonic: string;
}

interface SemitoneResult {
  kind: "semitone";
  text: string;
  label: string;
  changes: ChangePair[];
  chordpro: boolean;
}

interface KeyResult {
  kind: "key";
  text: string;
  from: string;
  to: string;
  changes: ChangePair[];
  chordpro: boolean;
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
  const textTargetWrap = requireElement("text_target_wrap");
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
  const textCurrentKeyLabel = requireSelector<HTMLLabelElement>(
    'label[for="text_current_key_trigger"]'
  );
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
  const textKeyDistanceWrap = requireElement("text_key_distance_wrap");
  const changes = createChangesDisclosure({
    wrap: requireElement("text_changes_wrap"),
    toggle: requireElement("text_changes_toggle"),
    label: requireElement("text_changes_label"),
    caret: requireElement("text_changes_caret"),
    list: requireElement("text_changes"),
  });
  const keyPicker = initKeyPicker({
    panel: requireElement("text_key_picker"),
    title: requireElement("text_key_picker_title"),
    distance: requireElement("text_key_distance"),
    fields: [
      {
        trigger: requireElement<HTMLButtonElement>("text_current_key_trigger"),
        label: requireElement("text_current_key_label"),
        select: textCurrentKey,
        title: "Current key",
      },
      {
        trigger: requireElement<HTMLButtonElement>("text_target_key_trigger"),
        label: requireElement("text_target_key_label"),
        select: textTargetKey,
        title: "Desired key",
      },
    ],
  });

  const stageView = createStageView();

  const panelPaste = requireElement("panel-paste");
  const MAX_SEMITONES = Number(panelPaste.dataset.maxSemitones);
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
  let instrument: Instrument = DEFAULT_INSTRUMENT;
  let renderedText = "";
  let transposeTimer: ReturnType<typeof setTimeout> | undefined;
  let chosenCurrentKey = textCurrentKey.value;

  function rememberCurrentKey(): void {
    chosenCurrentKey = textCurrentKey.value;
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

  function renderOutput(text: string): void {
    renderedText = text;
    diagrams.renderInto(textOutput, text);
    textCopy.disabled = text === "";
  }

  function clearOutput(): void {
    renderedText = "";
    textOutput.textContent = "";
    textCopy.disabled = true;
  }

  function hasOutput(): boolean {
    return renderedText.trim() !== "";
  }

  function updateCapoSuggestion(): void {
    const showCapo = transposeMode === "key" && instrument === "guitar";
    const message = showCapo ? formatCapoSuggestion(textTargetKey.value) : null;
    if (message !== null && hasOutput()) {
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
    textLineCount.textContent = pluralise(lines, "line");
  }

  function setToggleState(button: HTMLElement, attribute: string, active: boolean): void {
    button.setAttribute(attribute, String(active));
    button.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    button.classList.add(...(active ? MODE_ACTIVE_CLASSES : MODE_INACTIVE_CLASSES));
  }

  function selectMode(mode: TransposeMode): void {
    transposeMode = mode;
    const key = mode === "key";
    const nashville = mode === "nashville";

    controlsKey.classList.toggle("hidden", !(key || nashville));
    controlsSemitone.classList.toggle("hidden", mode !== "semitone");

    textTargetWrap.classList.toggle("hidden", nashville);
    textSwap.classList.toggle("hidden", nashville);
    textKeyDistanceWrap.classList.toggle("hidden", nashville);
    textCurrentKeyLabel.textContent = nashville ? "Tonic key" : "Current key";

    setToggleState(modeKey, "aria-selected", key);
    setToggleState(modeSemitone, "aria-selected", mode === "semitone");
    setToggleState(modeNashville, "aria-selected", nashville);

    if (nashville) {
      chordproFormatToggle.classList.add("hidden");
    }
    runTextTranspose();
    persistPrefs();
  }

  function updateSemitoneDisplay(): void {
    semitoneValue.textContent = semitones > 0 ? `+${semitones}` : String(semitones);
  }

  function clampSemitones(value: number): number {
    return Math.max(-MAX_SEMITONES, Math.min(MAX_SEMITONES, value));
  }

  function setSemitones(value: number): void {
    semitones = clampSemitones(value);
    updateSemitoneDisplay();
    runTextTranspose();
    persistPrefs();
  }

  function selectNotation(flat: boolean): void {
    useFlats = flat;
    setToggleState(notationSharp, "aria-pressed", !flat);
    setToggleState(notationFlat, "aria-pressed", flat);
    runTextTranspose();
    persistPrefs();
  }

  function selectOutputFormat(plain: boolean): void {
    outputFormat = plain ? "plain" : "chordpro";
    setToggleState(formatChordpro, "aria-pressed", !plain);
    setToggleState(formatPlain, "aria-pressed", plain);
    runTextTranspose();
  }

  function selectInstrument(value: unknown): void {
    instrument = isInstrument(value) ? value : DEFAULT_INSTRUMENT;
  }

  function maybePlain(text: string, chordpro: boolean): string {
    return chordpro && outputFormat === "plain" ? chordProToPlain(text) : text;
  }

  function computeResult(text: string): PasteResult {
    if (transposeMode === "nashville") {
      const result = textToNashville(text, textCurrentKey.value);
      return { kind: "nashville", text: result.text, tonic: result.tonic };
    }

    const chordpro = isChordProText(text);

    if (transposeMode === "semitone") {
      const result = chordpro
        ? transposeChordProTextBySemitones(text, semitones, useFlats)
        : transposeTextBySemitones(text, semitones, useFlats);
      return {
        kind: "semitone",
        text: maybePlain(result.text, chordpro),
        label: semitoneLabel(semitones, useFlats),
        changes: mapChanges(result.changes),
        chordpro,
      };
    }

    const result = chordpro
      ? transposeChordProText(text, textCurrentKey.value, textTargetKey.value)
      : transposeText(text, textCurrentKey.value, textTargetKey.value);
    return {
      kind: "key",
      text: maybePlain(result.text, chordpro),
      from: result.from,
      to: result.to,
      changes: mapChanges(result.changes),
      chordpro,
    };
  }

  function summariseResult(data: PasteResult): string {
    if (data.kind === "nashville") {
      return `Nashville · key of ${data.tonic}`;
    }
    const count = data.changes.length;
    const label = data.kind === "semitone" ? data.label : `${data.from} → ${data.to}`;
    return count > 0
      ? `${label} · ${pluralise(count, "chord")} changed`
      : `${label} · no chords found to change`;
  }

  function renderChanges(data: PasteResult): void {
    const pairs = data.kind === "nashville" ? [] : data.changes;
    if (pairs.length === 0) {
      changes.hide();
      return;
    }
    changes.show(
      pairs.map(({ from, to }) => {
        const pill = document.createElement("span");
        pill.className =
          "rounded-full border border-app-border-light bg-bg-light px-2 py-0.5 font-mono text-slate-700 dark:border-app-border dark:bg-bg dark:text-slate-200";
        pill.textContent = `${from} → ${to}`;
        return pill;
      })
    );
  }

  function syncOutputControls(): void {
    textStage.disabled = !hasOutput();
    updateCapoSuggestion();
  }

  function runTextTranspose(): void {
    keyPicker.refresh();
    const text = textInput.value;
    if (!text.trim()) {
      clearOutput();
      setTextStatus("");
      chordproFormatToggle.classList.add("hidden");
      changes.hide();
      syncOutputControls();
      return;
    }
    if (transposeMode === "key" && textCurrentKey.value === textTargetKey.value) {
      setTextStatus("Pick two different keys to transpose.");
      changes.hide();
      syncOutputControls();
      return;
    }
    if (transposeMode === "semitone" && semitones === 0) {
      renderOutput(text);
      setTextStatus("No shift · pick a semitone offset to transpose.");
      changes.hide();
      syncOutputControls();
      return;
    }

    try {
      const data = computeResult(text);
      const isChordPro = data.kind !== "nashville" && data.chordpro;
      chordproFormatToggle.classList.toggle("hidden", !isChordPro);

      renderOutput(data.text);
      setTextStatus(summariseResult(data));
      renderChanges(data);
    } catch (error) {
      changes.hide();
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
    }, TRANSPOSE_DEBOUNCE_MS);
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
    selectInstrument(textInstrument.value);
    diagrams.closePopover();
    updateCapoSuggestion();
    persistPrefs();
  });

  textStage.addEventListener("click", () => {
    if (!hasOutput()) return;
    stageView.open(renderedText);
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
    const target = event.target;
    const typing =
      target instanceof HTMLElement && ["TEXTAREA", "INPUT", "SELECT"].includes(target.tagName);
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
    textCurrentKey.value = savedPrefs.currentKey;
  }
  if (!panelPaste.dataset.preselectTo && savedPrefs.targetKey) {
    textTargetKey.value = savedPrefs.targetKey;
  }
  selectInstrument(panelPaste.dataset.instrument || savedPrefs.instrument);
  textInstrument.value = instrument;
  if (savedPrefs.semitones !== undefined) {
    semitones = clampSemitones(savedPrefs.semitones);
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
      await navigator.clipboard.writeText(renderedText);
      const original = textCopy.textContent;
      textCopy.textContent = "Copied";
      setTimeout(() => {
        textCopy.textContent = original;
      }, COPIED_FEEDBACK_MS);
    } catch {
      setTextStatus("Could not copy to clipboard.");
    }
  });
}
