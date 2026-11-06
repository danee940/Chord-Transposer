import type { Page } from "@playwright/test";

interface ClipboardRecorder {
  writes: string[];
  failing: boolean;
}

declare global {
  interface Window {
    e2eClipboard?: ClipboardRecorder;
  }
}

export class ClipboardSpy {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async install(): Promise<void> {
    await this.page.addInitScript(() => {
      const recorder: ClipboardRecorder = { writes: [], failing: false };
      window.e2eClipboard = recorder;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string): Promise<void> => {
            if (recorder.failing) throw new Error("Clipboard access denied.");
            recorder.writes.push(text);
          },
        },
      });
    });
  }

  async writes(): Promise<string[]> {
    return this.page.evaluate(() => window.e2eClipboard?.writes ?? []);
  }

  async denyAccess(): Promise<void> {
    await this.page.evaluate(() => {
      if (window.e2eClipboard) window.e2eClipboard.failing = true;
    });
  }
}
