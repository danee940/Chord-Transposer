import { expect, test } from "../support/test";

const SONG = "C        F        C\nTwinkle, twinkle, little star\nF   C   G7   C";
const SONG_IN_D = "D        G        D\nTwinkle, twinkle, little star\nG   D   A7   D";

test.describe("transposing by key", () => {
  test.beforeEach(async ({ home }) => {
    await home.goto();
  });

  test("transposes typed chords and keeps the lyric alignment @mobile", async ({ home }) => {
    const { paste } = home;
    await paste.enter(SONG);
    await expect.poll(() => paste.outputText()).toBe(SONG_IN_D);
    await expect(paste.status).toHaveText("C → D · 3 chords changed");
    await expect(paste.lineCount).toHaveText("3 lines");
  });

  test("reports when no chords are found", async ({ home }) => {
    await home.paste.enter("Just a lyric line");
    await expect(home.paste.status).toHaveText("C → D · no chords found to change");
    await expect(home.paste.changesWrap).toBeHidden();
  });

  test("inserts the sample sheet and detects its key", async ({ home }) => {
    const { paste } = home;
    await paste.sampleButton.click();
    await expect(paste.input).toHaveValue(/^ G {6}G7 {9}C {9}G\nAmazing grace/);
    await expect(paste.lineCount).toHaveText("4 lines");
    await expect(paste.detectedLabel).toHaveText("Detected: G");
    await expect(paste.keys.label("current")).toHaveText("G");
    await expect(paste.status).toHaveText("G → D · 5 chords changed");
    await expect(paste.chord("A7")).toBeVisible();
  });

  test("clears the input, output and detection", async ({ home }) => {
    const { paste } = home;
    await paste.sampleButton.click();
    await expect(paste.detectedWrap).toBeVisible();
    await paste.clearButton.click();
    await expect(paste.input).toHaveValue("");
    await expect(paste.output).toHaveText("");
    await expect(paste.status).toHaveText("");
    await expect(paste.lineCount).toHaveText("0 lines");
    await expect(paste.detectedWrap).toBeHidden();
    await expect(paste.copyButton).toBeDisabled();
    await expect(paste.stageButton).toBeDisabled();
  });

  test("asks for two different keys and keeps the last result", async ({ home }) => {
    const { paste } = home;
    await paste.enter(SONG);
    await expect.poll(() => paste.outputText()).toBe(SONG_IN_D);
    await paste.keys.choose("target", "C");
    await expect(paste.status).toHaveText("Pick two different keys to transpose.");
    await expect(paste.keys.distance).toHaveText("Same key");
    await expect.poll(() => paste.outputText()).toBe(SONG_IN_D);
  });

  test("swaps the current and desired keys", async ({ home }) => {
    const { paste } = home;
    await paste.enter("D  G  A");
    await expect(paste.keys.label("current")).toHaveText("D");
    await paste.keys.choose("target", "A");
    await paste.keys.swap();
    await expect(paste.keys.label("current")).toHaveText("A");
    await expect(paste.keys.label("target")).toHaveText("D");
    await expect.poll(() => paste.outputText()).toBe("G  C  D");
    await expect(paste.keys.distance).toHaveText("+5 semitones");
  });

  test("offers the alternate key of an ambiguous sheet and switches to it", async ({ home }) => {
    const { paste } = home;
    await paste.enter("Am  F  C  G");
    await expect(paste.detectedLabel).toHaveText("Detected: C");
    await expect(paste.detectedAlternate).toHaveText("or G?");
    await paste.detectedAlternate.click();
    await expect(paste.keys.label("current")).toHaveText("G");
    await expect(paste.detectedLabel).toHaveText("Detected: G");
    await expect(paste.detectedAlternate).toHaveText("or C?");
    await expect.poll(() => paste.outputText()).toBe("Em  C  G  D");
  });

  test("detection never overrides a key the reader picked", async ({ home }) => {
    const { paste } = home;
    await paste.keys.choose("current", "A");
    await paste.enter(SONG);
    await expect(paste.detectedLabel).toHaveText("Detected: C");
    await expect(paste.keys.label("current")).toHaveText("A");
    await expect(paste.status).toHaveText("A → D · 3 chords changed");
  });

  test("detection never overrides a key preselected by the URL", async ({ home }) => {
    await home.goto({ from: "G", to: "A" });
    await home.paste.enter(SONG);
    await expect(home.paste.detectedLabel).toHaveText("Detected: C");
    await expect(home.paste.keys.label("current")).toHaveText("G");
  });
});

test.describe("result details", () => {
  test.beforeEach(async ({ home }) => {
    await home.goto();
  });

  test("lists the chord changes in a collapsible disclosure", async ({ home }) => {
    const { paste } = home;
    await paste.enter(SONG);
    await expect(paste.changesToggle).toHaveText("Show 3 chord changes");
    await expect(paste.changesList).toBeHidden();
    await paste.changesToggle.click();
    await expect(paste.changesToggle).toHaveAttribute("aria-expanded", "true");
    await expect(paste.changesToggle).toHaveText("Hide 3 chord changes");
    await expect(paste.changesList.locator("span")).toHaveText(["C → D", "F → G", "G7 → A7"]);
    await paste.changesToggle.click();
    await expect(paste.changesList).toBeHidden();
  });

  test("suggests a capo for guitar only", async ({ home }) => {
    const { paste } = home;
    await paste.enter(SONG);
    await expect(paste.capoSuggestion).toHaveText("To sound in D, play D shapes with no capo.");
    await paste.keys.choose("target", "Bb");
    await expect(paste.capoSuggestion).toHaveText("To sound in Bb, capo 1 and play A shapes.");
    await paste.chooseInstrument("piano");
    await paste.keys.choose("target", "A");
    await expect(paste.capoSuggestion).toBeHidden();
  });
});

test.describe("copying the result", () => {
  test("copies the transposed text and confirms it", async ({ home, clipboard }) => {
    const { paste } = home;
    await home.goto();
    await expect(paste.copyButton).toBeDisabled();
    await paste.enter(SONG);
    await expect.poll(() => paste.outputText()).toBe(SONG_IN_D);
    await paste.copyButton.click();
    await expect(paste.copyButton).toHaveText("Copied");
    await expect.poll(() => clipboard.writes()).toEqual([SONG_IN_D]);
    await expect(paste.copyButton).toHaveText("Copy");
  });

  test("reports a clipboard failure", async ({ home, clipboard }) => {
    await home.goto();
    await home.paste.enter(SONG);
    await clipboard.denyAccess();
    await home.paste.copyButton.click();
    await expect(home.paste.status).toHaveText("Could not copy to clipboard.");
  });
});
