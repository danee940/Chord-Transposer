import type { Locator, Page } from "@playwright/test";
import { PastePanel } from "./paste-panel";
import { UploadPanel } from "./upload-panel";

export type HomeTab = "paste" | "upload";

export class HomePage {
  private readonly page: Page;

  readonly paste: PastePanel;
  readonly upload: UploadPanel;

  constructor(page: Page) {
    this.page = page;
    this.paste = new PastePanel(page);
    this.upload = new UploadPanel(page);
  }

  tab(tab: HomeTab): Locator {
    return this.page.locator(`#tab-${tab}`);
  }

  async goto(query: Readonly<Record<string, string>> = {}): Promise<void> {
    const search = new URLSearchParams(query).toString();
    await this.page.goto(search === "" ? "/" : `/?${search}`);
  }

  async openTab(tab: HomeTab): Promise<void> {
    await this.tab(tab).click();
  }
}
