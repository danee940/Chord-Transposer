import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";

interface LoadProblems {
  failedAssets: string[];
  consoleErrors: string[];
}

async function sitemapPaths(page: Page): Promise<string[]> {
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => new URL(url ?? "").pathname
  );
}

async function loadProblems(page: Page, path: string): Promise<LoadProblems> {
  const problems: LoadProblems = { failedAssets: [], consoleErrors: [] };
  const onResponse = (response: { url(): string; status(): number }): void => {
    if (response.url().includes("/static/") && response.status() >= 400) {
      problems.failedAssets.push(`${response.status()} ${response.url()}`);
    }
  };
  const onConsole = (message: { type(): string; text(): string }): void => {
    if (message.type() === "error") problems.consoleErrors.push(message.text());
  };
  page.on("response", onResponse);
  page.on("console", onConsole);
  await page.goto(path);
  page.off("response", onResponse);
  page.off("console", onConsole);
  return problems;
}

test("every indexed page loads its assets without errors @mobile", async ({ page }) => {
  const paths = await sitemapPaths(page);
  expect(paths).toContain("/");
  expect(paths.length).toBeGreaterThan(1);
  for (const path of paths) {
    expect(await loadProblems(page, path), `loading ${path}`).toEqual({
      failedAssets: [],
      consoleErrors: [],
    });
  }
});

test("the not found page loads its assets", async ({ page }) => {
  const { failedAssets } = await loadProblems(page, "/no-such-page");
  expect(failedAssets).toEqual([]);
});
