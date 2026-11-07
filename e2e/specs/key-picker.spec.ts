import { expect, test } from "../support/test";

test.beforeEach(async ({ home }) => {
  await home.goto();
});

test.describe("key picker", () => {
  test("opens per field and closes from the trigger, outside clicks and Escape", async ({
    home,
    page,
  }) => {
    const { keys } = home.paste;
    await keys.trigger("current").click();
    await expect(keys.panel).toBeVisible();
    await expect(keys.title).toHaveText("Current key");
    await expect(keys.trigger("current")).toHaveAttribute("aria-expanded", "true");

    await keys.trigger("target").click();
    await expect(keys.title).toHaveText("Desired key");
    await expect(keys.trigger("current")).toHaveAttribute("aria-expanded", "false");
    await expect(keys.trigger("target")).toHaveAttribute("aria-expanded", "true");

    await keys.trigger("target").click();
    await expect(keys.panel).toBeHidden();

    await keys.trigger("current").click();
    await page.locator("h1").click();
    await expect(keys.panel).toBeHidden();

    await keys.trigger("current").click();
    await page.keyboard.press("Escape");
    await expect(keys.panel).toBeHidden();
    await expect(keys.trigger("current")).toHaveAttribute("aria-expanded", "false");
  });

  test("lists major and minor keys with separate enharmonic spellings @mobile", async ({
    home,
  }) => {
    const { keys } = home.paste;
    await keys.open("target");
    await expect(keys.panel.getByText("Major", { exact: true })).toBeVisible();
    await expect(keys.panel.getByText("Minor", { exact: true })).toBeVisible();
    await expect(keys.keyButton("F#")).toHaveText("F♯");
    await expect(keys.keyButton("Gb")).toHaveText("G♭");
    await expect(keys.keyButton("Bbm")).toHaveText("B♭m");
    await expect(keys.keyButton("Gbm")).toHaveCount(0);
    await expect(keys.keyButton("D")).toHaveAttribute("aria-pressed", "true");
  });

  test("picking a key updates the field, the distance and returns focus", async ({ home }) => {
    const { keys } = home.paste;
    await keys.choose("target", "Gb");
    await expect(keys.panel).toBeHidden();
    await expect(keys.label("target")).toHaveText("G♭");
    await expect(keys.distance).toHaveText("+6 semitones");
    await expect(keys.interval).toHaveText("a tritone up");
    await expect(keys.trigger("target")).toBeFocused();

    await keys.choose("current", "Am");
    await expect(keys.label("current")).toHaveText("Am");
    await expect(keys.distance).toHaveText("−3 semitones");
    await expect(keys.interval).toHaveText("a minor third down");
  });

  test("can be driven from the keyboard", async ({ home, page }) => {
    const { keys } = home.paste;
    await keys.trigger("target").focus();
    await page.keyboard.press("Enter");
    await expect(keys.panel).toBeVisible();
    await keys.keyButton("E").focus();
    await page.keyboard.press("Enter");
    await expect(keys.label("target")).toHaveText("E");
    await expect(keys.trigger("target")).toBeFocused();
  });

  test("switching to German note names relabels the grid and keeps the pitch", async ({ home }) => {
    const { paste } = home;
    await paste.keys.choose("target", "Bb");
    await paste.enter("C   G   F");
    await expect.poll(() => paste.outputText()).toBe("Bb  F   Eb");

    await paste.keys.open("current");
    await paste.keys.notationButton("german").click();
    await expect(paste.keys.notationButton("german")).toHaveAttribute("aria-pressed", "true");
    await expect(paste.keys.notationButton("english")).toHaveAttribute("aria-pressed", "false");
    await expect(paste.keys.keyButton("H")).toHaveText("H");
    await expect(paste.keys.keyButton("Cis")).toHaveText("Cis");
    await expect(paste.keys.label("target")).toHaveText("B");
    await expect.poll(() => paste.outputText()).toBe("B   F   Es");

    await paste.keys.notationButton("english").click();
    await expect(paste.keys.label("target")).toHaveText("B♭");
    await expect.poll(() => paste.outputText()).toBe("Bb  F   Eb");
  });

  test("switches to German note names when the sheet uses them", async ({ home }) => {
    const { paste } = home;
    await paste.enter("H  E  Fis  H");
    await expect(paste.detectedLabel).toHaveText("Detected: H");
    await expect(paste.keys.label("current")).toHaveText("H");
    await paste.keys.open("current");
    await expect(paste.keys.notationButton("german")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("upload key picker", () => {
  test("uses the same grid for the upload panel", async ({ home }) => {
    await home.openTab("upload");
    const { keys } = home.upload;
    await keys.choose("current", "E");
    await keys.choose("target", "Ab");
    await expect(keys.label("current")).toHaveText("E");
    await expect(keys.label("target")).toHaveText("A♭");
    await expect(keys.distance).toHaveText("+4 semitones");
    await keys.swap();
    await expect(keys.label("current")).toHaveText("A♭");
    await expect(keys.distance).toHaveText("−4 semitones");
  });
});
