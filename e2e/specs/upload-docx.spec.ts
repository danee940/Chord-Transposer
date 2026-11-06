import type { UploadPanel } from "../pages/upload-panel";
import { docxParagraphs } from "../support/docx";
import { downloadedBytes } from "../support/downloads";
import { sheets } from "../support/files";
import { isPdf, pdfPageCount, pdfTextLines } from "../support/pdf";
import { expect, test } from "../support/test";

const FIRST_CHORD_LINE_IN_D = "D          D7         G          D";
const CHORUS_LINE_IN_D = "G          D          Bm         A";
const CORRECTED_CHORUS_LINE_IN_D = "G          D          Bm7        A";
const CORRECTED_CHORUS_LINE_IN_E = "A          E          C#m7       B";
const BLIND_LINE_IN_D = "           Bm         A7         D";
const CORRECTED_BLIND_LINE_IN_D = "           Bm7        A7         D";

async function replaceInPreview(upload: UploadPanel, line: string, edited: string): Promise<void> {
  const generated = await upload.previewText.inputValue();
  await upload.previewText.fill(generated.replace(line, edited));
}

test.beforeEach(async ({ home }) => {
  await home.goto();
  await home.openTab("upload");
  await home.upload.choose(sheets.amazingGraceDocx());
});

test.describe("uploading a .docx chord sheet", () => {
  test("names the chosen file and detects its key on the server", async ({ home }) => {
    const { upload } = home;
    await expect(upload.dropzoneText).toContainText("Amazing_Grace_C.docx");
    await expect(upload.dropzoneText).toContainText(/\d+ KB/);
    await expect(upload.detectedLabel).toHaveText("Detected: C");
    await expect(upload.keys.label("current")).toHaveText("C");
  });

  test("previews the transposed sheet with grouped changes @mobile", async ({ home }) => {
    const { upload } = home;
    await expect(upload.previewStatus).toHaveText("Preview · C → D");
    await expect(upload.previewText).toHaveValue(new RegExp(`^Amazing Grace\\n`));
    await expect.poll(() => upload.previewText.inputValue()).toContain(FIRST_CHORD_LINE_IN_D);
    await expect(upload.resetEditsButton).toBeHidden();

    await expect(upload.changesToggle).toHaveText("Show 6 chord changes");
    await upload.changesToggle.click();
    const rows = upload.changesList.locator(":scope > div");
    await expect(rows).toHaveCount(6);
    await expect(rows).toHaveText([
      "A → B · Am",
      "C → D · C7",
      "D → E · Dm",
      "E → F# · Em",
      "F → G",
      "G → A · G7",
    ]);
  });

  test("follows key changes and hides the preview for identical keys", async ({ home }) => {
    const { upload } = home;
    await upload.keys.choose("target", "F");
    await expect(upload.previewStatus).toHaveText("Preview · C → F");
    await expect
      .poll(() => upload.previewText.inputValue())
      .toContain("F          F7         Bb         F");

    await upload.keys.choose("target", "C");
    await expect(upload.preview).toBeHidden();
    await upload.submitButton.click();
    await expect(upload.message).toHaveText(
      "Current and desired keys are the same. Pick a different key to transpose."
    );
  });

  test("downloads the transposed .docx with formatting-safe content @mobile", async ({ home }) => {
    const { upload } = home;
    await expect(upload.preview).toBeVisible();
    const download = await upload.download();
    expect(download.suggestedFilename()).toBe("Amazing_Grace_C_D.docx");
    const paragraphs = docxParagraphs(await downloadedBytes(download));
    expect(paragraphs).toContain(FIRST_CHORD_LINE_IN_D);
    expect(paragraphs).toContain("Amazing grace, how sweet the sound");
    expect(paragraphs).toContain("D  D7  G  A  A7");
    await expect(upload.message).toHaveText(
      "Transposed from C to D · downloaded Amazing_Grace_C_D.docx"
    );
  });

  test("carries a preview edit into the download", async ({ home }) => {
    const { upload } = home;
    await expect(upload.preview).toBeVisible();
    await replaceInPreview(upload, CHORUS_LINE_IN_D, CORRECTED_CHORUS_LINE_IN_D);
    await expect(upload.resetEditsButton).toBeVisible();

    const paragraphs = docxParagraphs(await downloadedBytes(await upload.download()));
    expect(paragraphs).toContain(CORRECTED_CHORUS_LINE_IN_D);
    expect(paragraphs).not.toContain(CHORUS_LINE_IN_D);
  });

  test("re-transposes preview edits when the key changes", async ({ home }) => {
    const { upload } = home;
    await expect(upload.preview).toBeVisible();
    await replaceInPreview(upload, CHORUS_LINE_IN_D, CORRECTED_CHORUS_LINE_IN_D);
    await upload.keys.choose("target", "E");
    await expect(upload.previewStatus).toHaveText("Preview · C → E");
    await expect.poll(() => upload.previewText.inputValue()).toContain(CORRECTED_CHORUS_LINE_IN_E);

    const paragraphs = docxParagraphs(await downloadedBytes(await upload.download()));
    expect(paragraphs).toContain(CORRECTED_CHORUS_LINE_IN_E);
  });

  test("an edit to one of two identical paragraphs changes only that one", async ({ home }) => {
    const { upload } = home;
    await expect(upload.preview).toBeVisible();
    await replaceInPreview(upload, BLIND_LINE_IN_D, CORRECTED_BLIND_LINE_IN_D);

    const paragraphs = docxParagraphs(await downloadedBytes(await upload.download()));
    expect(paragraphs.filter((text) => text === CORRECTED_BLIND_LINE_IN_D)).toHaveLength(1);
    expect(paragraphs.filter((text) => text === BLIND_LINE_IN_D)).toHaveLength(1);
  });

  test("resets preview edits", async ({ home }) => {
    const { upload } = home;
    await expect(upload.preview).toBeVisible();
    const generated = await upload.previewText.inputValue();
    await replaceInPreview(upload, CHORUS_LINE_IN_D, CORRECTED_CHORUS_LINE_IN_D);
    await upload.resetEditsButton.click();
    await expect(upload.previewText).toHaveValue(generated);
    await expect(upload.previewText).toBeFocused();
    await expect(upload.resetEditsButton).toBeHidden();
  });

  test("converts the transposed sheet to PDF", async ({ home }) => {
    const { upload } = home;
    await upload.chooseFormat("pdf");
    const download = await upload.download();
    expect(download.suggestedFilename()).toBe("Amazing_Grace_C_D.pdf");
    const pdf = await downloadedBytes(download);
    expect(isPdf(pdf)).toBe(true);
    expect(pdfPageCount(pdf)).toBe(1);
    expect(pdfTextLines(pdf)).toContain(FIRST_CHORD_LINE_IN_D);
  });

  test("shows a busy state while transposing", async ({ home, page }) => {
    const { upload } = home;
    let releaseResponse: () => void = () => undefined;
    const responseHeld = new Promise<void>((resolve) => (releaseResponse = resolve));
    await page.route("/transpose", async (route) => {
      await responseHeld;
      await route.continue();
    });

    const download = page.waitForEvent("download");
    await upload.submitButton.click();
    await expect(upload.submitButton).toBeDisabled();
    await expect(upload.submitButton).toHaveText("Transposing...");
    await expect(upload.spinner).toBeVisible();

    releaseResponse();
    await download;
    await expect(upload.submitButton).toBeEnabled();
    await expect(upload.submitButton).toHaveText("Transpose & Download");
    await expect(upload.spinner).toBeHidden();
  });
});

test.describe("German notation sheets", () => {
  test("detects German keys and keeps German names in the download", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.germanDocx());
    await expect(upload.detectedLabel).toHaveText("Detected: H");
    await expect(upload.keys.label("current")).toHaveText("H");
    await upload.keys.choose("target", "Cis");
    await expect(upload.previewStatus).toHaveText("Preview · H → Cis");

    const paragraphs = docxParagraphs(await downloadedBytes(await upload.download()));
    expect(paragraphs).toContain("Cis        Fis        Gis        Cis");
  });

  test("converts a German sheet to English names on request", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.germanDocx());
    await expect(upload.keys.label("current")).toHaveText("H");
    await upload.keys.chooseNoteNames("english");
    await expect(upload.keys.label("current")).toHaveText("B");
    await upload.keys.choose("target", "C#");

    const paragraphs = docxParagraphs(await downloadedBytes(await upload.download()));
    expect(paragraphs).toContain("C#         F#         G#         C#");
  });
});
