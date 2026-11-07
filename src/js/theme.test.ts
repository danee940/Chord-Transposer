import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  currentTheme,
  initThemeSwitch,
  isTheme,
  loadTheme,
  resolvedScheme,
  setTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "./theme";

function setupDom(): void {
  document.head.innerHTML = `
    <meta name="theme-color" content="#efece5" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#141311" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#000000" />
  `;
  document.body.innerHTML = `
    <button data-theme-choice="light" aria-pressed="false"></button>
    <button data-theme-choice="system" aria-pressed="false"></button>
    <button data-theme-choice="dark" aria-pressed="false"></button>
    <button data-theme-choice="sepia" aria-pressed="false"></button>
  `;
}

function choice(theme: string): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-theme-choice="${theme}"]`)!;
}

function themeColors(): string[] {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
    (meta) => meta.content
  );
}

describe("theme", () => {
  let prefersDark: boolean;
  let onSchemeChange: () => void;

  beforeEach(() => {
    onSchemeChange = () => undefined;
    setupDom();
    localStorage.clear();
    delete document.documentElement.dataset["theme"];
    prefersDark = false;
    vi.stubGlobal("matchMedia", () => ({
      matches: prefersDark,
      addEventListener: (_type: string, listener: () => void) => {
        onSchemeChange = listener;
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("recognises the three themes", () => {
    expect(["system", "light", "dark"].every(isTheme)).toBe(true);
    expect(isTheme("sepia")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("loads the saved theme and falls back to the system theme", () => {
    expect(loadTheme()).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(loadTheme()).toBe("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(loadTheme()).toBe("system");
  });

  it("falls back to the system theme when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadTheme()).toBe("system");
  });

  it("applies an explicit theme to the document and the browser chrome", () => {
    const changes: unknown[] = [];
    document.addEventListener(THEME_CHANGE_EVENT, (event) =>
      changes.push((event as CustomEvent).detail)
    );
    applyTheme("dark");
    expect(document.documentElement.dataset["theme"]).toBe("dark");
    expect(currentTheme()).toBe("dark");
    expect(themeColors()).toEqual(["#141311", "#141311", "#141311"]);

    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(currentTheme()).toBe("system");
    expect(themeColors()).toEqual(["#efece5", "#141311", "#efece5"]);
    expect(changes).toEqual(["dark", "system"]);
  });

  it("resolves the system theme from the colour-scheme media query", () => {
    expect(resolvedScheme("light")).toBe("light");
    expect(resolvedScheme("system")).toBe("light");
    prefersDark = true;
    expect(resolvedScheme()).toBe("dark");
    applyTheme("light");
    expect(resolvedScheme()).toBe("light");
  });

  it("saves explicit themes and forgets the choice for the system theme", () => {
    setTheme("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    setTheme("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("still applies the theme when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    setTheme("dark");
    expect(currentTheme()).toBe("dark");
  });

  it("marks the saved choice and switches theme from the masthead", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    initThemeSwitch();
    expect(choice("light").getAttribute("aria-pressed")).toBe("true");
    expect(choice("system").getAttribute("aria-pressed")).toBe("false");

    choice("dark").click();
    expect(currentTheme()).toBe("dark");
    expect(choice("dark").getAttribute("aria-pressed")).toBe("true");
    expect(choice("light").getAttribute("aria-pressed")).toBe("false");

    choice("sepia").click();
    expect(currentTheme()).toBe("dark");
  });

  it("announces a system colour change only while following the system", () => {
    initThemeSwitch();
    const changes: unknown[] = [];
    document.addEventListener(THEME_CHANGE_EVENT, (event) =>
      changes.push((event as CustomEvent).detail)
    );
    onSchemeChange();
    expect(changes).toEqual(["system"]);
    setTheme("dark");
    onSchemeChange();
    expect(changes).toEqual(["system", "dark"]);
  });
});
