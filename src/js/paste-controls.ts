import type { OutputFormat, TransposeMode } from "./paste-result";

export interface PasteControlElements {
  modeKey: HTMLElement;
  modeSemitone: HTMLElement;
  modeNashville: HTMLElement;
  controlsKey: HTMLElement;
  controlsSemitone: HTMLElement;
  targetWrap: HTMLElement;
  swap: HTMLElement;
  keyDistanceWrap: HTMLElement;
  currentKeyLabel: HTMLLabelElement;
  formatToggle: HTMLElement;
  formatChordpro: HTMLElement;
  formatPlain: HTMLElement;
  semitoneValue: HTMLElement;
  semitoneDown: HTMLElement;
  semitoneUp: HTMLElement;
  semitoneQuick: readonly HTMLElement[];
  notationSharp: HTMLElement;
  notationFlat: HTMLElement;
}

export interface PasteControlsOptions {
  elements: PasteControlElements;
  maxSemitones: number;
  /** Re-run the transposition and save the panel's preferences. */
  onChange(): void;
  /** Re-run the transposition only; the output format is not a saved preference. */
  onFormatChange(): void;
}

export interface PasteControls {
  mode(): TransposeMode;
  semitones(): number;
  useFlats(): boolean;
  outputFormat(): OutputFormat;
  selectMode(mode: TransposeMode): void;
  setSemitones(value: number): void;
  selectNotation(flat: boolean): void;
  selectOutputFormat(plain: boolean): void;
  setFormatToggleVisible(visible: boolean): void;
  clamp(value: number): number;
  applySavedSemitones(value: number): void;
  refreshSemitoneDisplay(): void;
}

function setToggleState(button: HTMLElement, attribute: string, active: boolean): void {
  button.setAttribute(attribute, String(active));
}

export function createPasteControls({
  elements,
  maxSemitones,
  onChange,
  onFormatChange,
}: PasteControlsOptions): PasteControls {
  let mode: TransposeMode = "key";
  let semitones = 0;
  let useFlats = false;
  let outputFormat: OutputFormat = "chordpro";

  function clamp(value: number): number {
    return Math.max(-maxSemitones, Math.min(maxSemitones, value));
  }

  function refreshSemitoneDisplay(): void {
    elements.semitoneValue.textContent =
      semitones > 0 ? `+${semitones}` : String(semitones).replace("-", "−");
    elements.semitoneQuick.forEach((button) =>
      setToggleState(button, "aria-pressed", Number(button.dataset["semitone"]) === semitones)
    );
  }

  function selectMode(next: TransposeMode): void {
    mode = next;
    const key = next === "key";
    const nashville = next === "nashville";

    elements.controlsKey.classList.toggle("hidden", !(key || nashville));
    elements.controlsSemitone.classList.toggle("hidden", next !== "semitone");

    elements.targetWrap.classList.toggle("hidden", nashville);
    elements.swap.classList.toggle("hidden", nashville);
    elements.keyDistanceWrap.classList.toggle("hidden", nashville);
    elements.currentKeyLabel.textContent = nashville ? "Tonic key" : "Current key";

    setToggleState(elements.modeKey, "aria-selected", key);
    setToggleState(elements.modeSemitone, "aria-selected", next === "semitone");
    setToggleState(elements.modeNashville, "aria-selected", nashville);

    if (nashville) {
      elements.formatToggle.classList.add("hidden");
    }
    onChange();
  }

  function setSemitones(value: number): void {
    semitones = clamp(value);
    refreshSemitoneDisplay();
    onChange();
  }

  function selectNotation(flat: boolean): void {
    useFlats = flat;
    setToggleState(elements.notationSharp, "aria-pressed", !flat);
    setToggleState(elements.notationFlat, "aria-pressed", flat);
    onChange();
  }

  function selectOutputFormat(plain: boolean): void {
    outputFormat = plain ? "plain" : "chordpro";
    setToggleState(elements.formatChordpro, "aria-pressed", !plain);
    setToggleState(elements.formatPlain, "aria-pressed", plain);
    onFormatChange();
  }

  elements.modeKey.addEventListener("click", () => selectMode("key"));
  elements.modeSemitone.addEventListener("click", () => selectMode("semitone"));
  elements.modeNashville.addEventListener("click", () => selectMode("nashville"));
  elements.formatChordpro.addEventListener("click", () => selectOutputFormat(false));
  elements.formatPlain.addEventListener("click", () => selectOutputFormat(true));
  elements.semitoneDown.addEventListener("click", () => setSemitones(semitones - 1));
  elements.semitoneUp.addEventListener("click", () => setSemitones(semitones + 1));
  elements.semitoneQuick.forEach((button) =>
    button.addEventListener("click", () => setSemitones(Number(button.dataset["semitone"])))
  );
  elements.notationSharp.addEventListener("click", () => selectNotation(false));
  elements.notationFlat.addEventListener("click", () => selectNotation(true));

  document.addEventListener("keydown", (event) => {
    if (mode !== "semitone") return;
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

  return {
    mode: () => mode,
    semitones: () => semitones,
    useFlats: () => useFlats,
    outputFormat: () => outputFormat,
    selectMode,
    setSemitones,
    selectNotation,
    selectOutputFormat,
    setFormatToggleVisible(visible: boolean): void {
      elements.formatToggle.classList.toggle("hidden", !visible);
    },
    clamp,
    applySavedSemitones(value: number): void {
      semitones = clamp(value);
    },
    refreshSemitoneDisplay,
  };
}
