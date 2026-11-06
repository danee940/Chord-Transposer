import { expect, test } from "../support/test";

test.describe("Nashville numbers", () => {
  test("numbers the chords relative to the tonic key", async ({ home }) => {
    const { paste } = home;
    await home.goto();
    await paste.selectMode("nashville");
    await expect(paste.modeTab("nashville")).toHaveAttribute("aria-selected", "true");
    await expect(paste.currentKeyCaption).toHaveText("Tonic key");
    await expect(paste.targetKeyWrap).toBeHidden();
    await expect(paste.keys.swapButton).toBeHidden();

    await paste.enter("G   C   D7  Em  G");
    await expect(paste.keys.label("current")).toHaveText("G");
    await expect(paste.status).toHaveText("Nashville · key of G");
    await expect.poll(() => paste.outputText()).toBe("1   4   57  6m  1");
    await expect(paste.changesWrap).toBeHidden();
    await expect(paste.capoSuggestion).toBeHidden();
  });

  test("restores the key controls when leaving Nashville mode", async ({ home }) => {
    const { paste } = home;
    await home.goto();
    await paste.selectMode("nashville");
    await paste.selectMode("key");
    await expect(paste.currentKeyCaption).toHaveText("Current key");
    await expect(paste.targetKeyWrap).toBeVisible();
    await expect(paste.keys.swapButton).toBeVisible();
  });
});
