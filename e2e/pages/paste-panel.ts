import type { Locator, Page } from "@playwright/test";
import { ChordPopover } from "./chord-popover";
import { KeyPicker } from "./key-picker";
import { StageView } from "./stage-view";

export type PasteMode = "key" | "semitone" | "nashville";
export type Instrument = "guitar" | "ukulele" | "piano";

export class PastePanel {
  private readonly page: Page;

  readonly root: Locator;
  readonly keys: KeyPicker;
  readonly popover: ChordPopover;
  readonly stageView: StageView;

  readonly input: Locator;
  readonly output: Locator;
  readonly status: Locator;
  readonly lineCount: Locator;
  readonly sampleButton: Locator;
  readonly clearButton: Locator;
  readonly copyButton: Locator;
  readonly stageButton: Locator;
  readonly instrument: Locator;
  readonly capoSuggestion: Locator;
  readonly currentKeyCaption: Locator;
  readonly targetKeyWrap: Locator;

  readonly detectedWrap: Locator;
  readonly detectedLabel: Locator;
  readonly detectedAlternate: Locator;

  readonly semitoneControls: Locator;
  readonly semitoneValue: Locator;
  readonly semitoneDown: Locator;
  readonly semitoneUp: Locator;
  readonly sharpButton: Locator;
  readonly flatButton: Locator;

  readonly chordProToggle: Locator;
  readonly keepChordProButton: Locator;
  readonly plainChordsButton: Locator;

  readonly changesWrap: Locator;
  readonly changesToggle: Locator;
  readonly changesList: Locator;

  readonly transposedSheetToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#panel-paste");
    this.keys = new KeyPicker(page, "text_", "text_swap");
    this.popover = new ChordPopover(page);
    this.stageView = new StageView(page);

    this.input = page.locator("#text_input");
    this.output = page.locator("#text_output");
    this.status = page.locator("#text_status");
    this.lineCount = page.locator("#text_linecount");
    this.sampleButton = page.locator("#text_sample");
    this.clearButton = page.locator("#text_clear");
    this.copyButton = page.locator("#text_copy");
    this.stageButton = page.locator("#text_stage");
    this.instrument = page.locator("#text_instrument");
    this.capoSuggestion = page.locator("#capo-suggestion");
    this.currentKeyCaption = page.locator('label[for="text_current_key_trigger"]');
    this.targetKeyWrap = page.locator("#text_target_wrap");

    this.detectedWrap = page.locator("#text_detected_wrap");
    this.detectedLabel = page.locator("#text_detected_label");
    this.detectedAlternate = page.locator("#text_detected_alt");

    this.semitoneControls = page.locator("#controls-semitone");
    this.semitoneValue = page.locator("#semitone_value");
    this.semitoneDown = page.locator("#semitone_down");
    this.semitoneUp = page.locator("#semitone_up");
    this.sharpButton = page.locator("#notation_sharp");
    this.flatButton = page.locator("#notation_flat");

    this.chordProToggle = page.locator("#chordpro-format-toggle");
    this.keepChordProButton = page.locator("#format_chordpro");
    this.plainChordsButton = page.locator("#format_plain");

    this.changesWrap = page.locator("#text_changes_wrap");
    this.changesToggle = page.locator("#text_changes_toggle");
    this.changesList = page.locator("#text_changes");

    this.transposedSheetToggle = this.root.locator('button[data-sheet-view="output"]');
  }

  modeTab(mode: PasteMode): Locator {
    return this.page.locator(`#mode-${mode}`);
  }

  quickShift(semitones: number): Locator {
    return this.page.locator(`button.semitone-quick[data-semitone="${semitones}"]`);
  }

  chord(name: string): Locator {
    return this.output.getByRole("button", { name: `Show ${name} chord diagram`, exact: true });
  }

  async outputText(): Promise<string> {
    return (await this.output.textContent()) ?? "";
  }

  async selectMode(mode: PasteMode): Promise<void> {
    await this.modeTab(mode).click();
  }

  async enter(text: string): Promise<void> {
    await this.input.fill(text);
  }

  async showTransposed(): Promise<void> {
    if (await this.transposedSheetToggle.isVisible()) await this.transposedSheetToggle.click();
  }

  async chooseInstrument(instrument: Instrument): Promise<void> {
    await this.instrument.selectOption(instrument);
  }
}
