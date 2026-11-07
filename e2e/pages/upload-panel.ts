import type { Download, Locator, Page } from "@playwright/test";
import { KeyPicker } from "./key-picker";
import type { UploadFile } from "../support/files";

export type OutputFormat = "docx" | "pdf";

export class UploadPanel {
  private readonly page: Page;

  readonly root: Locator;
  readonly keys: KeyPicker;

  readonly fileInput: Locator;
  readonly dropzone: Locator;
  readonly dropzoneText: Locator;
  readonly submitButton: Locator;
  readonly spinner: Locator;
  readonly message: Locator;
  readonly fileList: Locator;
  readonly formatGroup: Locator;
  readonly binderFormatNote: Locator;

  readonly detectedWrap: Locator;
  readonly detectedLabel: Locator;
  readonly detectedAlternate: Locator;

  readonly preview: Locator;
  readonly previewStatus: Locator;
  readonly previewText: Locator;
  readonly resetEditsButton: Locator;
  readonly changesWrap: Locator;
  readonly changesToggle: Locator;
  readonly changesList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("#panel-upload");
    this.keys = new KeyPicker(page, "", "swap");

    this.fileInput = page.locator("#file");
    this.dropzone = page.locator("#dropzone");
    this.dropzoneText = page.locator("#dropzone-text");
    this.submitButton = page.locator("#submit");
    this.spinner = page.locator("#spinner");
    this.message = page.locator("#message");
    this.fileList = page.locator("#file_list");
    this.formatGroup = page.locator("#format_group");
    this.binderFormatNote = page.locator("#format_binder_note");

    this.detectedWrap = page.locator("#upload_detected_wrap");
    this.detectedLabel = page.locator("#upload_detected_label");
    this.detectedAlternate = page.locator("#upload_detected_alt");

    this.preview = page.locator("#upload_preview");
    this.previewStatus = page.locator("#upload_preview_status");
    this.previewText = page.locator("#upload_preview_text");
    this.resetEditsButton = page.locator("#upload_preview_reset");
    this.changesWrap = page.locator("#upload_changes_wrap");
    this.changesToggle = page.locator("#upload_changes_toggle");
    this.changesList = page.locator("#upload_changes");
  }

  fileRow(name: string): Locator {
    return this.fileList.locator(`li[data-file="${name}"]`);
  }

  async listedFiles(): Promise<string[]> {
    return this.fileList
      .locator("li")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-file") ?? ""));
  }

  async moveUp(name: string): Promise<void> {
    await this.fileRow(name)
      .getByRole("button", { name: `Move ${name} up` })
      .click();
  }

  async remove(name: string): Promise<void> {
    await this.fileRow(name)
      .getByRole("button", { name: `Remove ${name}` })
      .click();
  }

  formatOption(format: OutputFormat): Locator {
    return this.root.locator(`input[name="format"][value="${format}"]`);
  }

  async choose(...files: UploadFile[]): Promise<void> {
    await this.fileInput.setInputFiles(files);
  }

  async drop(...files: UploadFile[]): Promise<void> {
    const dataTransfer = await this.page.evaluateHandle(
      (payloads) => {
        const transfer = new DataTransfer();
        for (const { name, mimeType, base64 } of payloads) {
          const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
          transfer.items.add(new File([bytes], name, { type: mimeType }));
        }
        return transfer;
      },
      files.map(({ name, mimeType, buffer }) => ({
        name,
        mimeType,
        base64: buffer.toString("base64"),
      }))
    );
    await this.dropzone.dispatchEvent("dragenter", { dataTransfer });
    await this.dropzone.dispatchEvent("drop", { dataTransfer });
  }

  async chooseFormat(format: OutputFormat): Promise<void> {
    await this.formatOption(format).check();
  }

  async download(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.submitButton.click(),
    ]);
    return download;
  }
}
