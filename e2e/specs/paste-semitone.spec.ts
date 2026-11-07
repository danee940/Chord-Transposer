import { expect, test } from "../support/test";

test.beforeEach(async ({ home }) => {
  await home.goto();
  await home.paste.selectMode("semitone");
  await home.paste.enter("C   F   G7");
});

test.describe("transposing by semitones", () => {
  test("shows the semitone controls instead of the key pickers", async ({ home }) => {
    const { paste } = home;
    await expect(paste.modeTab("semitone")).toHaveAttribute("aria-selected", "true");
    await expect(paste.semitoneControls).toBeVisible();
    await expect(paste.keys.trigger("current")).toBeHidden();
    await expect(paste.status).toHaveText("No shift · pick a semitone offset to transpose.");
    await expect.poll(() => paste.outputText()).toBe("C   F   G7");
  });

  test("steps up and down one semitone at a time @mobile", async ({ home }) => {
    const { paste } = home;
    await paste.semitoneUp.click();
    await paste.semitoneUp.click();
    await expect(paste.semitoneValue).toHaveText("+2");
    await expect(paste.status).toHaveText("+2 semitones (♯) · 3 chords changed");
    await expect.poll(() => paste.outputText()).toBe("D   G   A7");

    await paste.semitoneDown.click();
    await paste.semitoneDown.click();
    await paste.semitoneDown.click();
    await expect(paste.semitoneValue).toHaveText("−1");
    await expect(paste.status).toHaveText("−1 semitone (♯) · 3 chords changed");
    await expect.poll(() => paste.outputText()).toBe("B   E   F#7");
  });

  test("jumps with the quick shift buttons and clamps at eleven", async ({ home }) => {
    const { paste } = home;
    await paste.quickShift(5).click();
    await expect(paste.semitoneValue).toHaveText("+5");
    await expect.poll(() => paste.outputText()).toBe("F   A#  C7");
    for (let step = 0; step < 8; step += 1) await paste.semitoneUp.click();
    await expect(paste.semitoneValue).toHaveText("+11");
    await paste.quickShift(0).click();
    await expect(paste.semitoneValue).toHaveText("0");
    await paste.quickShift(-5).click();
    for (let step = 0; step < 8; step += 1) await paste.semitoneDown.click();
    await expect(paste.semitoneValue).toHaveText("−11");
  });

  test("spells shifted chords with sharps or flats", async ({ home }) => {
    const { paste } = home;
    await paste.quickShift(1).click();
    await expect.poll(() => paste.outputText()).toBe("C#  F#  G#7");
    await paste.flatButton.click();
    await expect(paste.flatButton).toHaveAttribute("aria-pressed", "true");
    await expect(paste.sharpButton).toHaveAttribute("aria-pressed", "false");
    await expect(paste.status).toHaveText("+1 semitone (♭) · 3 chords changed");
    await expect.poll(() => paste.outputText()).toBe("Db  Gb  Ab7");
  });

  test("responds to the [ and ] shortcuts outside text fields", async ({ home, page }) => {
    const { paste } = home;
    await page.locator("h1").click();
    await page.keyboard.press("]");
    await page.keyboard.press("]");
    await page.keyboard.press("[");
    await expect(paste.semitoneValue).toHaveText("+1");

    await paste.input.press("End");
    await paste.input.press("]");
    await expect(paste.semitoneValue).toHaveText("+1");
    await expect(paste.input).toHaveValue("C   F   G7]");
  });
});
