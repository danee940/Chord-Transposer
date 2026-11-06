import type { Page } from "@playwright/test";

const WITHOUT_BACKDROP_BLUR =
  "* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }";

export async function disableBackdropBlur(page: Page): Promise<void> {
  await page.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    });
  }, WITHOUT_BACKDROP_BLUR);
}
