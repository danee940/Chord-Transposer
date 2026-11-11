import { createChangesDisclosure } from "./changes-disclosure";
import { createDetectionBadge } from "./detect-badge";
import { initDiagrams } from "./diagrams/index";
import { isInstrument, type Instrument } from "./diagrams/shapes";
import { pluralise, requireElement, requireSelector } from "./dom";
import { initKeyPicker } from "./key-picker";
import { createPasteControls } from "./paste-controls";
import { createPasteOutput } from "./paste-output";
import { persistPaste, savedKeyNames } from "./paste-prefs";
import {
  computeResult,
  isChordProResult,
  isTransposeMode,
  resultChanges,
  stageTitle,
  summariseResult,
} from "./paste-result";
import { loadPrefs } from "./prefs";
import { createStageView } from "./stage";
import { InvalidKeyError } from "./transpose/index";

const DEFAULT_INSTRUMENT: Instrument = "guitar";
const TRANSPOSE_DEBOUNCE_MS = 250;
const COPIED_FEEDBACK_MS = 1500;

const SAMPLE_CHORDS =
  " G      G7         C         G\n" +
  "Amazing grace, how sweet the sound\n" +
  "     G       Em          D7\n" +
  "That saved a wretch like me";

export function initPaste(): void {
  const textInput = requireElement<HTMLTextAreaElement>("text_input");
  const textCopy = requireElement<HTMLButtonElement>("text_copy");
  const textCurrentKey = requireElement<HTMLSelectElement>("text_current_key");
  const textTargetKey = requireElement<HTMLSelectElement>("text_target_key");
  const textSwap = requireElement("text_swap");
  const textLineCount = requireElement("text_linecount");
  const textSample = requireElement("text_sample");
  const textClear = requireElement("text_clear");
  const textInstrument = requireElement<HTMLSelectElement>("text_instrument");
  const textStage = requireElement<HTMLButtonElement>("text_stage");

  const panelPaste = requireElement("panel-paste");
  const savedPrefs = loadPrefs();
  const stageView = createStageView();

  let instrument: Instrument = DEFAULT_INSTRUMENT;
  let stageHeading = "";
  let transposeTimer: ReturnType<typeof setTimeout> | undefined;
  let chosenCurrentKey = textCurrentKey.value;

  const diagrams = initDiagrams(() => instrument);

  const output = createPasteOutput({
    elements: {
      output: requireElement("text_output"),
      status: requireElement("text_status"),
      copy: textCopy,
      stage: textStage,
      capoSuggestion: requireElement("capo-suggestion"),
    },
    changes: createChangesDisclosure({
      wrap: requireElement("text_changes_wrap"),
      toggle: requireElement("text_changes_toggle"),
      label: requireElement("text_changes_label"),
      caret: requireElement("text_changes_caret"),
      list: requireElement("text_changes"),
    }),
    renderInto: (target, text) => diagrams.renderInto(target, text),
    capoApplies: () => controls.mode() === "key" && instrument === "guitar",
    targetKey: () => textTargetKey.value,
  });

  function rememberCurrentKey(): void {
    chosenCurrentKey = textCurrentKey.value;
  }

  function persistPrefs(): void {
    persistPaste({
      mode: controls.mode(),
      currentKey: chosenCurrentKey,
      targetKey: textTargetKey.value,
      semitones: controls.semitones(),
      useFlats: controls.useFlats(),
      keyNames: keyPicker.notationOverride(),
      instrument,
    });
  }

  function runTextTranspose(): void {
    keyPicker.refresh();
    const text = textInput.value;
    if (!text.trim()) {
      output.clear();
      output.setStatus("");
      controls.setFormatToggleVisible(false);
      output.hideChanges();
      output.syncControls();
      return;
    }
    if (controls.mode() === "key" && textCurrentKey.value === textTargetKey.value) {
      output.setStatus("Pick two different keys to transpose.");
      output.hideChanges();
      output.syncControls();
      return;
    }
    if (controls.mode() === "semitone" && controls.semitones() === 0) {
      output.render(text, false);
      stageHeading = "No shift";
      output.setStatus("No shift · pick a semitone offset to transpose.");
      output.hideChanges();
      output.syncControls();
      return;
    }

    try {
      const data = computeResult(text, {
        mode: controls.mode(),
        currentKey: textCurrentKey.value,
        targetKey: textTargetKey.value,
        semitones: controls.semitones(),
        useFlats: controls.useFlats(),
        outputFormat: controls.outputFormat(),
        notation: keyPicker.notationOverride(),
      });
      controls.setFormatToggleVisible(isChordProResult(data));

      output.render(data.text, true);
      stageHeading = stageTitle(data);
      output.setStatus(summariseResult(data));
      output.showChanges(resultChanges(data));
    } catch (error) {
      output.hideChanges();
      output.setStatus(error instanceof InvalidKeyError ? error.message : "Something went wrong.");
    }
    output.syncControls();
  }

  const controls = createPasteControls({
    elements: {
      modeKey: requireElement("mode-key"),
      modeSemitone: requireElement("mode-semitone"),
      modeNashville: requireElement("mode-nashville"),
      controlsKey: requireElement("controls-key"),
      controlsSemitone: requireElement("controls-semitone"),
      targetWrap: requireElement("text_target_wrap"),
      swap: textSwap,
      keyDistanceWrap: requireElement("text_key_distance_wrap"),
      currentKeyLabel: requireSelector<HTMLLabelElement>('label[for="text_current_key_trigger"]'),
      formatToggle: requireElement("chordpro-format-toggle"),
      formatChordpro: requireElement("format_chordpro"),
      formatPlain: requireElement("format_plain"),
      semitoneValue: requireElement("semitone_value"),
      semitoneDown: requireElement("semitone_down"),
      semitoneUp: requireElement("semitone_up"),
      semitoneQuick: [...document.querySelectorAll<HTMLElement>(".semitone-quick")],
      notationSharp: requireElement("notation_sharp"),
      notationFlat: requireElement("notation_flat"),
    },
    maxSemitones: Number(panelPaste.dataset["maxSemitones"]),
    onChange: () => {
      runTextTranspose();
      persistPrefs();
    },
    onFormatChange: () => runTextTranspose(),
  });

  const keyPicker = initKeyPicker({
    savedNotation: savedKeyNames(savedPrefs.keyNames),
    onNotationPick: () => {
      persistPrefs();
      runTextTranspose();
    },
    panel: requireElement("text_key_picker"),
    title: requireElement("text_key_picker_title"),
    distance: requireElement("text_key_distance"),
    interval: requireElement("text_key_interval"),
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

  function applyPreselect(select: HTMLSelectElement, value: string | undefined): void {
    if (value && [...select.options].some((option) => option.value === value)) {
      select.value = value;
    }
  }
  applyPreselect(textCurrentKey, panelPaste.dataset["preselectFrom"]);
  applyPreselect(textTargetKey, panelPaste.dataset["preselectTo"]);

  function updateLineCount(): void {
    const value = textInput.value;
    const lines = value === "" ? 0 : value.split("\n").length;
    textLineCount.textContent = pluralise(lines, "line");
  }

  function selectInstrument(value: unknown): void {
    instrument = isInstrument(value) ? value : DEFAULT_INSTRUMENT;
  }

  const detection = createDetectionBadge({
    wrap: requireElement("text_detected_wrap"),
    label: requireElement("text_detected_label"),
    altButton: requireElement("text_detected_alt"),
    select: textCurrentKey,
    onAltPick: () => {
      rememberCurrentKey();
      runTextTranspose();
      persistPrefs();
    },
    onNotation: (german) => keyPicker.setNotation(german),
  });
  if (panelPaste.dataset["preselectFrom"]) {
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
    output.updateCapo();
    persistPrefs();
  });

  textStage.addEventListener("click", () => {
    if (!output.hasOutput()) return;
    stageView.open(output.text(), stageHeading);
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

  if (!panelPaste.dataset["preselectFrom"] && savedPrefs.currentKey) {
    textCurrentKey.value = savedPrefs.currentKey;
  }
  if (!panelPaste.dataset["preselectTo"] && savedPrefs.targetKey) {
    textTargetKey.value = savedPrefs.targetKey;
  }
  selectInstrument(panelPaste.dataset["instrument"] || savedPrefs.instrument);
  textInstrument.value = instrument;
  if (savedPrefs.semitones !== undefined) {
    controls.applySavedSemitones(savedPrefs.semitones);
  }

  rememberCurrentKey();

  controls.selectOutputFormat(false);
  controls.selectNotation(savedPrefs.notation === "flat");
  controls.refreshSemitoneDisplay();
  detection.detect(textInput.value);
  controls.selectMode(isTransposeMode(savedPrefs.mode) ? savedPrefs.mode : "key");
  updateLineCount();

  textCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.text());
      const original = textCopy.textContent;
      textCopy.textContent = "Copied";
      setTimeout(() => {
        textCopy.textContent = original;
      }, COPIED_FEEDBACK_MS);
    } catch {
      output.setStatus("Could not copy to clipboard.");
    }
  });
}
