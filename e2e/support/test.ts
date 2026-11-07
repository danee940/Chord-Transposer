import { test as base, expect } from "@playwright/test";
import { HomePage } from "../pages/home-page";
import { ClipboardSpy } from "./clipboard";

interface Fixtures {
  home: HomePage;
  clipboard: ClipboardSpy;
  failOnPageErrors: void;
}

export const test = base.extend<Fixtures>({
  home: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  clipboard: async ({ page }, use) => {
    const spy = new ClipboardSpy(page);
    await spy.install();
    await use(spy);
  },
  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));
      await use();
      expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
