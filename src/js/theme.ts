export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];
export type ColorScheme = Exclude<Theme, "system">;

export const THEME_STORAGE_KEY = "chord-transposer:theme";
export const THEME_CHANGE_EVENT = "themechange";

const DESK_COLORS: Readonly<Record<ColorScheme, string>> = {
  light: "#efece5",
  dark: "#141311",
};
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function saveTheme(theme: Theme): void {
  try {
    if (theme === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    return;
  }
}

export function currentTheme(): Theme {
  const applied = document.documentElement.dataset["theme"];
  return isTheme(applied) ? applied : "system";
}

export function resolvedScheme(theme: Theme = currentTheme()): ColorScheme {
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function schemeOfMedia(media: string): ColorScheme {
  return media.includes("dark") ? "dark" : "light";
}

function syncThemeColor(theme: Theme): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme: ColorScheme =
      theme === "system" ? schemeOfMedia(meta.getAttribute("media") ?? "") : theme;
    meta.content = DESK_COLORS[scheme];
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === "system") {
    delete document.documentElement.dataset["theme"];
  } else {
    document.documentElement.dataset["theme"] = theme;
  }
  syncThemeColor(theme);
  document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
}

export function setTheme(theme: Theme): void {
  saveTheme(theme);
  applyTheme(theme);
}

export function initThemeSwitch(): void {
  const choices = [...document.querySelectorAll<HTMLButtonElement>("button[data-theme-choice]")];

  function markChoices(): void {
    const theme = currentTheme();
    for (const choice of choices) {
      choice.setAttribute("aria-pressed", String(choice.dataset["themeChoice"] === theme));
    }
  }

  for (const choice of choices) {
    const theme = choice.dataset["themeChoice"];
    if (isTheme(theme)) choice.addEventListener("click", () => setTheme(theme));
  }
  document.addEventListener(THEME_CHANGE_EVENT, markChoices);
  window.matchMedia(DARK_QUERY).addEventListener("change", () => {
    if (currentTheme() === "system") applyTheme("system");
  });
  applyTheme(loadTheme());
}
