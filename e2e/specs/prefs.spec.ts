import { expect, test } from "../support/test";

const PREFS_KEY = "chord-transposer:prefs";

test.describe("remembered paste settings", () => {
  test("restores mode, keys, offset, accidentals, instrument and note names", async ({
    home,
    page,
  }) => {
    const { paste } = home;
    await home.goto();
    await paste.keys.choose("current", "E");
    await paste.keys.choose("target", "A");
    await paste.keys.chooseNoteNames("german");
    await paste.chooseInstrument("ukulele");
    await paste.selectMode("semitone");
    await paste.quickShift(3).click();
    await paste.flatButton.click();

    await page.reload();
    await expect(paste.modeTab("semitone")).toHaveAttribute("aria-selected", "true");
    await expect(paste.semitoneValue).toHaveText("+3");
    await expect(paste.flatButton).toHaveAttribute("aria-pressed", "true");
    await expect(paste.instrument).toHaveValue("ukulele");

    await paste.selectMode("key");
    await expect(paste.keys.label("current")).toHaveText("E");
    await expect(paste.keys.label("target")).toHaveText("A");
    await paste.keys.open("current");
    await expect(paste.keys.notationButton("german")).toHaveAttribute("aria-pressed", "true");
  });

  test("ignores unreadable stored settings", async ({ home, page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "{not json"), PREFS_KEY);
    await home.goto();
    await expect(home.paste.modeTab("key")).toHaveAttribute("aria-selected", "true");
    await expect(home.paste.keys.label("current")).toHaveText("C");
    await home.paste.enter("C  G");
    await expect.poll(() => home.paste.outputText()).toBe("D  A");
  });

  test("a URL preselection wins over the stored keys", async ({ home, page }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, JSON.stringify({ currentKey: "E", targetKey: "A" })),
      PREFS_KEY
    );
    await home.goto({ from: "F", to: "G" });
    await expect(home.paste.keys.label("current")).toHaveText("F");
    await expect(home.paste.keys.label("target")).toHaveText("G");
  });

  test("an instrument landing page wins over the stored instrument", async ({ home, page }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, JSON.stringify({ instrument: "piano" })),
      PREFS_KEY
    );
    await page.goto("/ukulele-chord-transposer");
    await expect(home.paste.instrument).toHaveValue("ukulele");
  });
});
