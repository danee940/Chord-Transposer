import { downloadedBytes, downloadedText } from "../support/downloads";
import { sheets, uploadFile } from "../support/files";
import { isPdf, pdfTextLines } from "../support/pdf";
import { expect, test } from "../support/test";

const TWINKLE_IN_D = [
  "Verse",
  "D        G        D",
  "Twinkle, twinkle, little star",
  "G        D        A7       D",
  "How I wonder what you are",
  "",
].join("\n");

test.beforeEach(async ({ home }) => {
  await home.goto();
  await home.openTab("upload");
});

test.describe("uploading text chord sheets", () => {
  test("detects the key in the browser and previews the result", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.plainText());
    await expect(upload.detectedLabel).toHaveText("Detected: C");
    await expect(upload.previewStatus).toHaveText("Preview · C → D");
    await expect(upload.previewText).toHaveValue(TWINKLE_IN_D.trimEnd());
  });

  test("downloads a transposed .txt @mobile", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.plainText());
    await expect(upload.preview).toBeVisible();
    const download = await upload.download();
    expect(download.suggestedFilename()).toBe("Twinkle_C_D.txt");
    expect(await downloadedText(download)).toBe(TWINKLE_IN_D);
    await expect(upload.message).toHaveText("Transposed from C to D · downloaded Twinkle_C_D.txt");
  });

  test("carries preview edits into a .txt download", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.plainText());
    await expect(upload.preview).toBeVisible();
    const generated = await upload.previewText.inputValue();
    await upload.previewText.fill(generated.replace("A7       D", "A7sus4   D"));
    const text = await downloadedText(await upload.download());
    expect(text).toContain("G        D        A7sus4   D\n");
  });

  test("downloads a ChordPro sheet as .pro", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.chordPro());
    await expect(upload.preview).toBeVisible();
    const download = await upload.download();
    expect(download.suggestedFilename()).toBe("Twinkle_C_D.pro");
    expect(await downloadedText(download)).toBe(
      [
        "{title: Twinkle Twinkle}",
        "[D]Twinkle, twinkle, [G]little [D]star",
        "[G]How I [D]wonder [A7]what you [D]are",
        "",
      ].join("\n")
    );
  });

  test("converts a text sheet to PDF", async ({ home }) => {
    const { upload } = home;
    await upload.choose(sheets.plainText());
    await upload.chooseFormat("pdf");
    const download = await upload.download();
    expect(download.suggestedFilename()).toBe("Twinkle_C_D.pdf");
    const pdf = await downloadedBytes(download);
    expect(isPdf(pdf)).toBe(true);
    expect(pdfTextLines(pdf)).toContain("G        D        A7       D");
  });

  test("handles German text sheets", async ({ home }) => {
    const { upload } = home;
    await upload.choose(uploadFile("Wiegenlied_E.txt", "E        A        H7\nLa la la\n"));
    await expect(upload.detectedLabel).toHaveText("Detected: E");
    await upload.keys.open("current");
    await expect(upload.keys.notationButton("german")).toHaveAttribute("aria-pressed", "true");
    await upload.keys.trigger("current").click();
    await upload.keys.choose("target", "G");
    expect(await downloadedText(await upload.download())).toBe("G        C        D7\nLa la la\n");
  });
});
