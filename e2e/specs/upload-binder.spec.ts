import { downloadedBytes } from "../support/downloads";
import { sheets } from "../support/files";
import { isPdf, pdfPageCount, pdfTextLines } from "../support/pdf";
import { expect, test } from "../support/test";

test.describe("PDF binder", () => {
  test.beforeEach(async ({ home }) => {
    await home.goto();
    await home.openTab("upload");
  });

  test("combines several transposed .docx files into one PDF @mobile", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.amazingGraceDocx(), sheets.secondSongDocx());
    await expect(upload.dropzoneText).toContainText("2 files selected");
    await expect(upload.preview).toBeHidden();
    await expect(upload.detectedWrap).toBeHidden();

    const download = await upload.download();
    expect(download.suggestedFilename()).toBe("chord_binder_D.pdf");
    const pdf = await downloadedBytes(download);
    expect(isPdf(pdf)).toBe(true);
    expect(pdfPageCount(pdf)).toBe(2);
    const lines = pdfTextLines(pdf);
    expect(lines.indexOf("D          D7         G          D")).toBeGreaterThan(-1);
    expect(lines.indexOf("A          E          F#m        D")).toBeGreaterThan(
      lines.indexOf("D          D7         G          D")
    );
    await expect(upload.message).toHaveText("Binder created from 2 files");
  });

  test("applies the note names picked in the key picker", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.germanDocx(), sheets.secondSongDocx());
    await upload.keys.chooseNoteNames("english");
    await upload.keys.choose("current", "B");
    await upload.keys.choose("target", "C#");

    const lines = pdfTextLines(await downloadedBytes(await upload.download()));
    expect(lines).toContain("C#         F#         G#         C#");
    expect(lines.join("\n")).not.toMatch(/\b(Cis|Fis|Gis)\b/);
  });

  test("builds a binder from dropped files", async ({ home }) => {
    const { upload } = home;
    await upload.drop(sheets.amazingGraceDocx(), sheets.secondSongDocx(), sheets.germanDocx());
    await expect(upload.dropzoneText).toContainText("3 files selected");
    const pdf = await downloadedBytes(await upload.download());
    expect(pdfPageCount(pdf)).toBe(3);
  });
});
