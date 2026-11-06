import { expect, test } from "../support/test";

const CHORDPRO = "{title: Twinkle}\n[C]Twinkle, twinkle, [F]little [C]star";

test.describe("ChordPro input", () => {
  test.beforeEach(async ({ home }) => {
    await home.goto();
    await home.paste.enter(CHORDPRO);
  });

  test("keeps ChordPro brackets and makes bracketed chords clickable", async ({ home }) => {
    const { paste } = home;
    await expect(paste.chordProToggle).toBeVisible();
    await expect(paste.keepChordProButton).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => paste.outputText())
      .toBe("{title: Twinkle}\n[D]Twinkle, twinkle, [G]little [D]star");
    await expect(paste.chord("G")).toBeVisible();
  });

  test("converts to chords over lyrics on request", async ({ home }) => {
    const { paste } = home;
    await paste.plainChordsButton.click();
    await expect(paste.plainChordsButton).toHaveAttribute("aria-pressed", "true");
    await expect(paste.keepChordProButton).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => paste.outputText()).not.toContain("[");
    await paste.keepChordProButton.click();
    await expect.poll(() => paste.outputText()).toContain("[D]Twinkle");
  });

  test("hides the format toggle for plain chord sheets and in Nashville mode", async ({ home }) => {
    const { paste } = home;
    await paste.selectMode("nashville");
    await expect(paste.chordProToggle).toBeHidden();
    await paste.selectMode("key");
    await paste.enter("C  F  G");
    await expect(paste.chordProToggle).toBeHidden();
  });
});
