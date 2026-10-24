import { formatCapoSuggestion } from "./capo-suggest.js";
import { createDetectionBadge } from "./detect-badge.js";
import { initDiagrams } from "./diagrams/index.js";
import { MODE_ACTIVE_CLASSES, MODE_INACTIVE_CLASSES } from "./dom.js";
import { loadPrefs, savePrefs } from "./prefs.js";
import { createStageView } from "./stage.js";
import {
  chordProToPlain,
  InvalidKeyError,
  isChordProText,
  textToNashville,
  transposeChordProText,
  transposeChordProTextBySemitones,
  transposeText,
  transposeTextBySemitones,
} from "./transpose/index.js";

function semitoneLabel(count, useFlats) {
  const accidental = useFlats ? "♭" : "♯";
  if (count === 0) return `No change (${accidental})`;
  const sign = count > 0 ? "+" : "−";
  const magnitude = Math.abs(count);
  const unit = magnitude === 1 ? "semitone" : "semitones";
  return `${sign}${magnitude} ${unit} (${accidental})`;
}

function mapChanges(changes) {
  return changes.map(([from, to]) => ({ from, to }));
}

export function initPaste() {
  const textInput = document.getElementById("text_input");
  const textOutput = document.getElementById("text_output");
  const textStatus = document.getElementById("text_status");
  const textCopy = document.getElementById("text_copy");
  const textCurrentKey = document.getElementById("text_current_key");
  const textTargetKey = document.getElementById("text_target_key");
  const textSwap = document.getElementById("text_swap");
  const textLineCount = document.getElementById("text_linecount");
  const textSample = document.getElementById("text_sample");
  const textClear = document.getElementById("text_clear");
  const textDetectedWrap = document.getElementById("text_detected_wrap");
  const textDetectedLabel = document.getElementById("text_detected_label");
  const textDetectedAlt = document.getElementById("text_detected_alt");

  const modeKey = document.getElementById("mode-key");
  const modeSemitone = document.getElementById("mode-semitone");
  const modeNashville = document.getElementById("mode-nashville");
  const controlsKey = document.getElementById("controls-key");
  const controlsSemitone = document.getElementById("controls-semitone");
  const textCurrentKeyLabel = document.querySelector('label[for="text_current_key"]');
  const chordproFormatToggle = document.getElementById("chordpro-format-toggle");
  const formatChordpro = document.getElementById("format_chordpro");
  const formatPlain = document.getElementById("format_plain");
  const semitoneValue = document.getElementById("semitone_value");
  const semitoneDown = document.getElementById("semitone_down");
  const semitoneUp = document.getElementById("semitone_up");
  const semitoneQuick = document.querySelectorAll(".semitone-quick");
  const notationSharp = document.getElementById("notation_sharp");
  const notationFlat = document.getElementById("notation_flat");
  const textInstrument = document.getElementById("text_instrument");
  const textStage = document.getElementById("text_stage");
  const capoSuggestion = document.getElementById("capo-suggestion");
  const textChanges = document.getElementById("text_changes");
  const textChangesWrap = document.getElementById("text_changes_wrap");
  const textChangesToggle = document.getElementById("text_changes_toggle");
  const textChangesLabel = document.getElementById("text_changes_label");
  const textChangesCaret = document.getElementById("text_changes_caret");

  const stageView = createStageView();

  const panelPaste = document.getElementById("panel-paste");
  const MAX_SEMITONES = parseInt(panelPaste.dataset.maxSemitones, 10);
  const diagrams = initDiagrams(() => instrument);

  function applyPreselect(select, value) {
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

  let transposeMode = "key";
  let semitones = 0;
  let useFlats = false;
  let outputFormat = "chordpro";
  let instrument = "guitar";
  let transposeTimer = null;
  let chosenCurrentKey = textCurrentKey.value;

  function rememberCurrentKey() {
    chosenCurrentKey = textCurrentKey.value;
  }

  function persistPrefs() {
    savePrefs({
      mode: transposeMode,
      currentKey: chosenCurrentKey,
      targetKey: textTargetKey.value,
      semitones,
      notation: useFlats ? "flat" : "sharp",
      instrument,
    });
  }

  function setTextStatus(text) {
    textStatus.textContent = text;
  }

  function updateCapoSuggestion() {
    const showCapo = transposeMode === "key" && instrument === "guitar";
    const message = showCapo ? formatCapoSuggestion(textTargetKey.value) : null;
    if (message && textOutput.textContent.trim()) {
      capoSuggestion.textContent = message;
      capoSuggestion.classList.remove("hidden");
    } else {
      capoSuggestion.textContent = "";
      capoSuggestion.classList.add("hidden");
    }
  }

  function updateLineCount() {
    const value = textInput.value;
    const lines = value === "" ? 0 : value.split("\n").length;
    textLineCount.textContent = `${lines} line${lines === 1 ? "" : "s"}`;
  }

  function setModeButtonState(button, active) {
    button.setAttribute("aria-selected", String(active));
    button.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    button.classList.add(...(active ? MODE_ACTIVE_CLASSES : MODE_INACTIVE_CLASSES));
  }

  function selectMode(mode) {
    transposeMode = mode;
    const key = mode === "key";
    const nashville = mode === "nashville";
    const showKeyControls = key || nashville;

    controlsKey.classList.toggle("hidden", !showKeyControls);
    controlsSemitone.classList.toggle("hidden", mode !== "semitone");

    textTargetKey.parentElement.classList.toggle("hidden", nashville);
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

  function updateSemitoneDisplay() {
    semitoneValue.textContent = semitones > 0 ? `+${semitones}` : String(semitones);
  }

  function setSemitones(value) {
    semitones = Math.max(-MAX_SEMITONES, Math.min(MAX_SEMITONES, value));
    updateSemitoneDisplay();
    runTextTranspose();
    persistPrefs();
  }

  function selectNotation(flat) {
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

  function selectOutputFormat(plain) {
    outputFormat = plain ? "plain" : "chordpro";
    formatChordpro.setAttribute("aria-pressed", String(!plain));
    formatPlain.setAttribute("aria-pressed", String(plain));
    formatChordpro.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    formatPlain.classList.remove(...MODE_ACTIVE_CLASSES, ...MODE_INACTIVE_CLASSES);
    formatChordpro.classList.add(...(plain ? MODE_INACTIVE_CLASSES : MODE_ACTIVE_CLASSES));
    formatPlain.classList.add(...(plain ? MODE_ACTIVE_CLASSES : MODE_INACTIVE_CLASSES));
    runTextTranspose();
  }

  function maybePlain(text) {
    return outputFormat === "plain" ? chordProToPlain(text) : text;
  }

  function computeResult(text) {
    if (transposeMode === "nashville") {
      const result = textToNashville(text, textCurrentKey.value);
      return { text: result.text, tonic: result.tonic };
    }

    const chordpro = isChordProText(text);

    if (transposeMode === "semitone") {
      const result = chordpro
        ? transposeChordProTextBySemitones(text, semitones, useFlats)
        : transposeTextBySemitones(text, semitones, useFlats);
      const data = {
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
    const data = {
      text: chordpro ? maybePlain(result.text) : result.text,
      from: result.from,
      to: result.to,
      changes: mapChanges(result.changes),
    };
    if (chordpro) data.format = "chordpro";
    return data;
  }

  function summariseResult(data) {
    if (transposeMode === "nashville") {
      return `Nashville · key of ${data.tonic}`;
    }
    const count = Array.isArray(data.changes) ? data.changes.length : 0;
    const label = transposeMode === "semitone" ? data.label : `${data.from} → ${data.to}`;
    return count > 0
      ? `${label} · ${count} chord${count === 1 ? "" : "s"} changed`
      : `${label} · no chords found to change`;
  }

  let changesCount = 0;

  function changesLabel(action) {
    return `${action} ${changesCount} chord change${changesCount === 1 ? "" : "s"}`;
  }

  function collapseChanges() {
    textChanges.classList.add("hidden");
    textChangesToggle.setAttribute("aria-expanded", "false");
    textChangesCaret.classList.remove("rotate-90");
    textChangesLabel.textContent = changesLabel("Show");
  }

  function expandChanges() {
    textChanges.classList.remove("hidden");
    textChangesToggle.setAttribute("aria-expanded", "true");
    textChangesCaret.classList.add("rotate-90");
    textChangesLabel.textContent = changesLabel("Hide");
  }

  function hideChanges() {
    textChanges.replaceChildren();
    textChangesWrap.classList.add("hidden");
    collapseChanges();
  }

  function renderChanges(data) {
    const changes = Array.isArray(data.changes) ? data.changes : [];
    if (transposeMode === "nashville" || changes.length === 0) {
      hideChanges();
      return;
    }
    const seen = new Set();
    const pills = [];
    for (const { from, to } of changes) {
      const key = `${from}→${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
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

  function syncOutputControls() {
    textStage.disabled = !textOutput.textContent.trim();
    updateCapoSuggestion();
  }

  function runTextTranspose() {
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

  function scheduleTextTranspose() {
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
    instrument = textInstrument.value;
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
    if (!textOutput.textContent.trim()) return;
    stageView.open(textOutput.textContent);
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
      target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT");
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
  const pageInstrument = panelPaste.dataset.instrument;
  if (pageInstrument) {
    instrument = pageInstrument;
  } else if (savedPrefs.instrument) {
    instrument = savedPrefs.instrument;
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
  selectMode(["key", "semitone", "nashville"].includes(savedPrefs.mode) ? savedPrefs.mode : "key");
  updateLineCount();

  textCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textOutput.textContent);
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
