import { expect, test } from "../support/test";

const DESK_LIGHT = "rgb(239, 236, 229)";
const DESK_DARK = "rgb(20, 19, 17)";

test.describe("colour theme", () => {
  test("switches to dark, keeps it across pages and returns to the system theme @mobile", async ({
    home,
    page,
  }) => {
    await home.goto();
    const choice = (name: string) => page.getByRole("button", { name });
    const desk = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect(choice("Match system theme")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(desk).toBe(DESK_LIGHT);

    await choice("Dark theme").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(choice("Dark theme")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(desk).toBe(DESK_DARK);

    await page.goto("/chromatic-chart");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(desk).toBe(DESK_DARK);

    await choice("Match system theme").click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    await page.reload();
    await expect.poll(desk).toBe(DESK_LIGHT);
  });

  test("an explicit light theme wins over a dark system setting", async ({ home, page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await home.goto();
    const desk = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect.poll(desk).toBe(DESK_DARK);
    await page.getByRole("button", { name: "Light theme" }).click();
    await expect.poll(desk).toBe(DESK_LIGHT);
  });

  test("the stage view can flip the theme for the room", async ({ home, page }) => {
    await home.goto();
    await home.paste.enter("C   F   G");
    await home.paste.stageButton.click();
    await home.paste.stageView.root.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await home.paste.stageView.closeButton.click();
    await expect(page.getByRole("button", { name: "Dark theme" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
