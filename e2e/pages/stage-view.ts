import type { Locator, Page } from "@playwright/test";

export class StageView {
  readonly root: Locator;
  readonly heading: Locator;
  readonly sheet: Locator;
  readonly chords: Locator;
  readonly columnsToggle: Locator;
  readonly scroller: Locator;
  readonly playButton: Locator;
  readonly speed: Locator;
  readonly smallerText: Locator;
  readonly largerText: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.root = page.getByRole("dialog", { name: "Performance view" });
    this.heading = this.root.getByRole("heading", { level: 2 });
    this.sheet = this.root.locator(".stage-sheet");
    this.chords = this.sheet.locator(".stage-chord");
    this.columnsToggle = this.root.getByRole("button", { name: "2 columns" });
    this.scroller = this.sheet.locator("..");
    this.playButton = this.root.getByRole("button", { name: /^(Play|Pause)$/ });
    this.speed = this.root.getByRole("slider", { name: "Autoscroll speed" });
    this.smallerText = this.root.getByRole("button", { name: "Decrease font size" });
    this.largerText = this.root.getByRole("button", { name: "Increase font size" });
    this.closeButton = this.root.getByRole("button", { name: "Close performance view" });
  }

  async fontSize(): Promise<number> {
    return this.sheet.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  }

  async scrollTop(): Promise<number> {
    return this.scroller.evaluate((element) => element.scrollTop);
  }
}
