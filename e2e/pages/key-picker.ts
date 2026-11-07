import type { Locator, Page } from "@playwright/test";

export type KeyField = "current" | "target";
export type NoteNames = "english" | "german";

export class KeyPicker {
  private readonly page: Page;
  private readonly prefix: string;

  readonly panel: Locator;
  readonly title: Locator;
  readonly distance: Locator;
  readonly interval: Locator;
  readonly swapButton: Locator;

  constructor(page: Page, prefix: string, swapId: string) {
    this.page = page;
    this.prefix = prefix;
    this.panel = page.locator(`#${prefix}key_picker`);
    this.title = page.locator(`#${prefix}key_picker_title`);
    this.distance = page.locator(`#${prefix}key_distance`);
    this.interval = page.locator(`#${prefix}key_interval`);
    this.swapButton = page.locator(`#${swapId}`);
  }

  trigger(field: KeyField): Locator {
    return this.page.locator(`#${this.prefix}${field}_key_trigger`);
  }

  label(field: KeyField): Locator {
    return this.page.locator(`#${this.prefix}${field}_key_label`);
  }

  keyButton(key: string): Locator {
    return this.panel.locator(`button[data-key="${key}"]`);
  }

  notationButton(names: NoteNames): Locator {
    return this.panel.locator(`button[data-notation="${names}"]`);
  }

  async open(field: KeyField): Promise<void> {
    if ((await this.trigger(field).getAttribute("aria-expanded")) !== "true") {
      await this.trigger(field).click();
    }
  }

  async choose(field: KeyField, key: string): Promise<void> {
    await this.open(field);
    await this.keyButton(key).click();
  }

  async chooseNoteNames(names: NoteNames): Promise<void> {
    await this.open("current");
    await this.notationButton(names).click();
    await this.page.keyboard.press("Escape");
  }

  async swap(): Promise<void> {
    await this.swapButton.click();
  }
}
