import type { Locator, Page } from "@playwright/test";

export class ChordPopover {
  readonly root: Locator;
  readonly closeButton: Locator;
  readonly body: Locator;
  readonly diagram: Locator;

  constructor(page: Page) {
    this.root = page.getByRole("dialog", { name: "Chord fingering" });
    this.closeButton = this.root.getByRole("button", { name: "Close chord diagram" });
    this.body = this.root.locator(".diagram-body");
    this.diagram = this.body.locator("svg");
  }
}
