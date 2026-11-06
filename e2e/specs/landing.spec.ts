import { downloadedBytes } from "../support/downloads";
import { docxParagraphs } from "../support/docx";
import { sheets } from "../support/files";
import { expect, test } from "../support/test";

const INSTRUMENT_PAGES = [
  { path: "/guitar-chord-transposer", h1: "Guitar chord transposer", crumb: "Guitar" },
  { path: "/ukulele-chord-transposer", h1: "Ukulele chord transposer", crumb: "Ukulele" },
  { path: "/piano-chord-transposer", h1: "Piano chord transposer", crumb: "Piano" },
] as const;

test.describe("instrument landing pages", () => {
  for (const { path, h1, crumb } of INSTRUMENT_PAGES) {
    test(`${h1} preselects its instrument and transposes pasted chords`, async ({ home, page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]')
      ).toHaveText(crumb);
      await expect(page.getByRole("tablist", { name: "Transpose mode" })).toHaveCount(0);
      await expect(home.paste.instrument).toHaveValue(crumb.toLowerCase());

      await home.paste.enter("C   F   G");
      await expect(home.paste.status).toContainText("3 chords changed");
      await home.paste.output.getByRole("button").first().click();
      await expect(home.paste.popover.body).toContainText(`· ${crumb}`);
    });
  }

  test("the guitar page preselects C to G", async ({ home, page }) => {
    await page.goto("/guitar-chord-transposer");
    await expect(home.paste.keys.label("current")).toHaveText("C");
    await expect(home.paste.keys.label("target")).toHaveText("G");
  });
});

test.describe("guitar capo calculator", () => {
  test("lists capo positions for the chosen key @mobile", async ({ page }) => {
    await page.goto("/guitar-chord-transposer");
    const calculator = page.locator("#capo-calculator");
    await expect(calculator.getByRole("heading", { name: "Guitar capo calculator" })).toBeVisible();
    await expect(page.getByLabel("Key you want to sound")).toHaveValue("G");

    const table = calculator.locator("#capo-table-output table");
    await expect(table.locator("th")).toHaveText(["Capo fret", "Play shape", "Sounds like"]);
    await expect(table.locator("tbody tr").first()).toHaveText(/^No capo\s*G\s*G$/);
    await expect(table.locator("tbody tr td:first-child")).toHaveText([
      "No capo",
      "2",
      "3",
      "5",
      "7",
    ]);

    await page.getByLabel("Key you want to sound").selectOption("Bm");
    await expect(table.locator("tbody tr td:nth-child(3)").first()).toHaveText("Bm");
    const shapes = await table.locator("tbody tr td:nth-child(2)").allInnerTexts();
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) expect(shape).toMatch(/m$/);
  });

  test("is only offered on the guitar page", async ({ page }) => {
    await page.goto("/ukulele-chord-transposer");
    await expect(page.locator("#capo-calculator")).toHaveCount(0);
  });
});

test.describe("chromatic chart page", () => {
  test("shows the chart and a working paste panel", async ({ home, page }) => {
    await page.goto("/chromatic-chart");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Chromatic transposition chart"
    );
    await expect(page.locator("table").first()).toBeVisible();
    await home.paste.enter("C  G");
    await expect.poll(() => home.paste.outputText()).not.toBe("");
  });
});

test.describe("file transposer page", () => {
  test("offers the upload panel on its own and downloads a transposed sheet @mobile", async ({
    home,
    page,
  }) => {
    await page.goto("/file-chord-transposer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("File chord transposer");
    await expect(home.upload.root).toBeVisible();
    await expect(home.paste.root).toHaveCount(0);

    await home.upload.choose(sheets.amazingGraceDocx());
    await expect(home.upload.previewStatus).toHaveText("Preview · C → D");
    const download = await home.upload.download();
    expect(docxParagraphs(await downloadedBytes(download))).toContain(
      "D          D7         G          D"
    );
  });
});
