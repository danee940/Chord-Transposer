import { expect, test } from "../support/test";

const LONG_SHEET = Array.from({ length: 80 }, (_, line) =>
  line % 2 === 0 ? "C        F        G" : `Lyric line ${line}`
).join("\n");

test.beforeEach(async ({ home }) => {
  await home.goto();
  await home.paste.enter(LONG_SHEET);
  await expect(home.paste.stageButton).toBeEnabled();
});

test.describe("stage view", () => {
  test("shows the transposed sheet full screen and locks the page scroll @mobile", async ({
    home,
    page,
  }) => {
    const { paste } = home;
    await paste.stageButton.click();
    await expect(paste.stageView.root).toBeVisible();
    await expect(paste.stageView.sheet).toContainText("D        G        A");
    await expect(paste.stageView.sheet.locator("button")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/overflow-hidden/);

    await paste.stageView.closeButton.click();
    await expect(paste.stageView.root).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/overflow-hidden/);
    await expect(paste.stageButton).toBeFocused();
  });

  test("changes the font size within its limits", async ({ home }) => {
    const { stageView } = home.paste;
    await home.paste.stageButton.click();
    await expect.poll(() => stageView.fontSize()).toBe(24);
    await stageView.largerText.click();
    await expect.poll(() => stageView.fontSize()).toBe(26);
    for (let step = 0; step < 20; step += 1) await stageView.largerText.click();
    await expect.poll(() => stageView.fontSize()).toBe(48);
    for (let step = 0; step < 20; step += 1) await stageView.smallerText.click();
    await expect.poll(() => stageView.fontSize()).toBe(16);
  });

  test("autoscrolls while playing and stops on pause", async ({ home }) => {
    const { stageView } = home.paste;
    await home.paste.stageButton.click();
    await stageView.speed.fill("240");
    await stageView.playButton.click();
    await expect(stageView.playButton).toHaveText("Pause");
    await expect(stageView.playButton).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => stageView.scrollTop()).toBeGreaterThan(20);

    await stageView.playButton.click();
    await expect(stageView.playButton).toHaveText("Play");
    const pausedAt = await stageView.scrollTop();
    await expect.poll(() => stageView.scrollTop(), { timeout: 1000 }).toBe(pausedAt);
  });

  test("toggles playback with Space and closes with Escape", async ({ home, page }) => {
    const { stageView } = home.paste;
    await home.paste.stageButton.click();
    await expect(stageView.root).toBeFocused();
    await page.keyboard.press("Space");
    await expect(stageView.playButton).toHaveText("Pause");
    await page.keyboard.press("Escape");
    await expect(stageView.root).toBeHidden();

    await home.paste.stageButton.click();
    await expect(stageView.playButton).toHaveText("Play");
  });
});
