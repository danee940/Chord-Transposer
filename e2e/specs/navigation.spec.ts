import { expect, test } from "../support/test";

test.describe("home page tabs", () => {
  test("starts on the paste panel and switches to upload and back @mobile", async ({ home }) => {
    await home.goto();
    await expect(home.tab("paste")).toHaveAttribute("aria-selected", "true");
    await expect(home.paste.root).toBeVisible();
    await expect(home.upload.root).toBeHidden();

    await home.openTab("upload");
    await expect(home.tab("upload")).toHaveAttribute("aria-selected", "true");
    await expect(home.tab("paste")).toHaveAttribute("aria-selected", "false");
    await expect(home.upload.root).toBeVisible();
    await expect(home.paste.root).toBeHidden();

    await home.openTab("paste");
    await expect(home.paste.root).toBeVisible();
    await expect(home.upload.root).toBeHidden();
  });
});

test.describe("key preselection from the query string", () => {
  test("preselects both paste keys", async ({ home }) => {
    await home.goto({ from: "Eb", to: "G" });
    await expect(home.paste.keys.label("current")).toHaveText("E♭");
    await expect(home.paste.keys.label("target")).toHaveText("G");
    await expect(home.paste.keys.distance).toHaveText("+4 semitones");
  });

  test("ignores keys that are not offered", async ({ home }) => {
    await home.goto({ from: "H", to: "X#" });
    await expect(home.paste.keys.label("current")).toHaveText("C");
    await expect(home.paste.keys.label("target")).toHaveText("D");
  });

  test("leaves the upload panel on its defaults", async ({ home }) => {
    await home.goto({ from: "A", to: "B" });
    await home.openTab("upload");
    await expect(home.upload.keys.label("current")).toHaveText("C");
    await expect(home.upload.keys.label("target")).toHaveText("D");
  });

  test("redirects a retired key-pair page to the preselected home page", async ({ home, page }) => {
    const response = await page.request.get("/transpose/c-sharp-to-d", { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()["location"]).toBe("/?from=C%23&to=D");

    await page.goto("/transpose/c-sharp-to-d");
    await expect(page).toHaveURL("/?from=C%23&to=D");
    await expect(home.paste.keys.label("current")).toHaveText("C♯");
    await expect(home.paste.keys.label("target")).toHaveText("D");
  });
});

test.describe("not found page", () => {
  test("renders the branded 404 for unknown paths and retired slugs", async ({ page }) => {
    for (const path of ["/no-such-page", "/transpose/c-to-nowhere"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("That page is out of key");
    }
  });

  test("links back to the transposer and the landing pages @mobile", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.getByRole("link", { name: "File chord transposer" })).toHaveAttribute(
      "href",
      "/file-chord-transposer"
    );
    await page.getByRole("link", { name: "Transpose chords" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator("#panel-paste")).toBeVisible();
  });
});

test.describe("shared page furniture", () => {
  test("the link hub navigates to a landing page and marks it as current", async ({ page }) => {
    await page.goto("/");
    const hub = page.locator("section", { hasText: "Explore more transposers" });
    await hub.getByRole("link", { name: "File transposer" }).click();
    await expect(page).toHaveURL("/file-chord-transposer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("File chord transposer");
    await expect(
      page
        .locator("section", { hasText: "Explore more transposers" })
        .getByRole("link", { name: "File transposer" })
    ).toHaveClass(/font-semibold/);
  });

  test("FAQ answers expand and collapse", async ({ page }) => {
    await page.goto("/");
    const firstQuestion = page.locator("details").first();
    await expect(firstQuestion).not.toHaveAttribute("open");
    await firstQuestion.locator("summary").click();
    await expect(firstQuestion).toHaveAttribute("open");
    await firstQuestion.locator("summary").click();
    await expect(firstQuestion).not.toHaveAttribute("open");
  });

  test("the nav keeps the project links and shortens on small screens @mobile", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "View on GitHub" })).toBeVisible();
    const coffeeLabel = page.locator("nav").getByText("Buy me a coffee");
    if (isMobile) {
      await expect(coffeeLabel).toBeHidden();
    } else {
      await expect(coffeeLabel).toBeVisible();
    }
  });
});
