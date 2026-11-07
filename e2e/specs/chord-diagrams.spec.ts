import { expect, test } from "../support/test";

test.beforeEach(async ({ home }) => {
  await home.goto();
  await home.paste.enter("C   Adim   G7");
  await home.paste.showTransposed();
});

test.describe("chord diagrams", () => {
  test("opens a guitar fingering for a clicked chord @mobile", async ({ home }) => {
    const { paste } = home;
    await paste.chord("A7").click();
    await expect(paste.popover.root).toBeVisible();
    await expect(paste.popover.body).toContainText("A7");
    await expect(paste.popover.body).toContainText("dominant 7th · Guitar");
    await expect(paste.popover.body).toContainText("A · C# · E · G");
    await expect(paste.popover.diagram).toBeVisible();
    await expect(paste.popover.closeButton).toBeFocused();
  });

  test("follows the chosen instrument", async ({ home }) => {
    const { paste } = home;
    await paste.chooseInstrument("piano");
    await paste.chord("D").click();
    await expect(paste.popover.body).toContainText("major · Piano");
    await expect(paste.popover.diagram).toBeVisible();

    await paste.chooseInstrument("ukulele");
    await expect(paste.popover.root).toBeHidden();
    await paste.chord("Bdim").click();
    await expect(paste.popover.body).toContainText("diminished · Ukulele");
    await expect(paste.popover.body).toContainText("No stored Ukulele shape.");
    await expect(paste.popover.diagram).toHaveCount(0);
  });

  test("closes from the close button, Escape and outside clicks and restores focus", async ({
    home,
    page,
  }) => {
    const { paste } = home;
    await paste.chord("D").click();
    await paste.popover.closeButton.click();
    await expect(paste.popover.root).toBeHidden();
    await expect(paste.chord("D")).toBeFocused();

    await paste.chord("A7").click();
    await page.keyboard.press("Escape");
    await expect(paste.popover.root).toBeHidden();
    await expect(paste.chord("A7")).toBeFocused();

    await paste.chord("A7").click();
    await page.locator("h1").click();
    await expect(paste.popover.root).toBeHidden();
  });

  test("closes when the output is re-rendered", async ({ home }) => {
    const { paste } = home;
    await paste.chord("D").click();
    await expect(paste.popover.root).toBeVisible();
    await paste.keys.choose("target", "E");
    await expect(paste.popover.root).toBeHidden();
    await expect(paste.chord("E")).toBeVisible();
  });
});
