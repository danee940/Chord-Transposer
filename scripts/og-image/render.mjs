import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const source = new URL("./og-image.html", import.meta.url);
const target = fileURLToPath(new URL("../../src/static/og-image.png", import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(source.href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: target });
await browser.close();
