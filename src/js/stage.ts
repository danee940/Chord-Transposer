import { buildChordMarkup } from "./diagrams/output";
import { resolvedScheme, setTheme, THEME_CHANGE_EVENT } from "./theme";

export const AUTOSCROLL_MIN_SPEED = 10;
export const AUTOSCROLL_MAX_SPEED = 240;
export const AUTOSCROLL_DEFAULT_SPEED = 60;

export interface StageView {
  open(text: string, heading: string): void;
}

interface StageElements {
  overlay: HTMLDivElement;
  heading: HTMLHeadingElement;
  sheet: HTMLDivElement;
  scroller: HTMLDivElement;
  applyFontSize(): void;
  setPlaying(next: boolean): void;
  syncThemeToggle(): void;
}

interface WakeLockHold {
  acquire(): void;
  release(): void;
}

export function clampAutoscrollSpeed(speed: number): number {
  if (Number.isNaN(speed)) return AUTOSCROLL_DEFAULT_SPEED;
  return Math.min(Math.max(speed, AUTOSCROLL_MIN_SPEED), AUTOSCROLL_MAX_SPEED);
}

export function autoscrollStep(
  scrollTop: number,
  speedPerSecond: number,
  deltaMs: number,
  maxScrollTop: number
): number {
  const ceiling = Math.max(maxScrollTop, 0);
  const advanced = scrollTop + (speedPerSecond * deltaMs) / 1000;
  return Math.min(Math.max(advanced, 0), ceiling);
}

export function autoscrollAtEnd(scrollTop: number, maxScrollTop: number): boolean {
  return scrollTop >= Math.max(maxScrollTop, 0) - 1;
}

const FONT_STEP = 2;
const FONT_MIN = 16;
const FONT_MAX = 48;
const FONT_DEFAULT = 24;

export function clampFontSize(size: number): number {
  return Math.min(Math.max(size, FONT_MIN), FONT_MAX);
}

const MONO_ADVANCE_EM = 0.6;

export function fittingFontSize(availableWidth: number, longestLine: number): number {
  if (availableWidth <= 0 || longestLine === 0) return FONT_DEFAULT;
  const fitting = Math.floor(availableWidth / (longestLine * MONO_ADVANCE_EM));
  return clampFontSize(Math.min(FONT_DEFAULT, fitting));
}

export function splitStanzas(text: string): string[] {
  const stanzas: string[][] = [];
  let current: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") {
      if (current.length > 0) stanzas.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) stanzas.push(current);
  return stanzas.map((lines) => lines.join("\n"));
}

export function longestLineLength(text: string): number {
  return Math.max(0, ...text.split(/\r?\n/).map((line) => line.length));
}

function stageChord(displayText: string): HTMLSpanElement {
  const chord = document.createElement("span");
  chord.className = "stage-chord";
  chord.textContent = displayText;
  return chord;
}

function renderSheet(sheet: HTMLElement, text: string): void {
  sheet.style.setProperty("--stage-line-length", String(longestLineLength(text)));
  sheet.replaceChildren(
    ...splitStanzas(text).map((stanza) => {
      const block = document.createElement("div");
      block.className = "stage-stanza";
      block.appendChild(buildChordMarkup(stanza, stageChord));
      return block;
    })
  );
}

export function createWakeLockHold(): WakeLockHold {
  let wanted = false;
  let requesting = false;
  let sentinel: WakeLockSentinel | null = null;

  function acquire(): void {
    wanted = true;
    if (!("wakeLock" in navigator) || requesting || sentinel !== null) return;
    requesting = true;
    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        if (!wanted) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        requesting = false;
      });
  }

  function release(): void {
    wanted = false;
    const lock = sentinel;
    sentinel = null;
    if (lock !== null) void lock.release();
  }

  document.addEventListener("visibilitychange", () => {
    if (wanted && document.visibilityState === "visible") acquire();
  });

  return { acquire, release };
}

const SUN_ICON =
  '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="3.25"/><path d="M10 2.5v1.75M10 15.75v1.75M2.5 10h1.75M15.75 10h1.75M4.7 4.7l1.24 1.24M14.06 14.06l1.24 1.24M4.7 15.3l1.24-1.24M14.06 5.94l1.24-1.24"/></svg>';
const MOON_ICON =
  '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 12.2A6.75 6.75 0 0 1 7.8 3.5a6.75 6.75 0 1 0 8.7 8.7z"/></svg>';

function readableWidth(scroller: HTMLElement): number {
  const style = getComputedStyle(scroller);
  return scroller.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

const FONT_KEY_STEPS: Readonly<Partial<Record<string, number>>> = {
  "+": FONT_STEP,
  "=": FONT_STEP,
  "-": -FONT_STEP,
  _: -FONT_STEP,
};

function isControl(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement || target instanceof HTMLInputElement;
}

function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility !== "function" || element.checkVisibility();
}

export function createStageView(): StageView {
  let elements: StageElements | null = null;
  let fontSize = FONT_DEFAULT;
  let fontSizeChosen = false;
  let speed = AUTOSCROLL_DEFAULT_SPEED;
  let playing = false;
  let lastTimestamp: number | null = null;
  let frame: number | null = null;
  let lastFocused: Element | null = null;
  const wakeLock = createWakeLockHold();

  function stopLoop(): void {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    lastTimestamp = null;
  }

  function stageButton(label: string, className = "btn"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }

  function build(): StageElements {
    const overlay = document.createElement("div");
    overlay.className = "stage hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Performance view");

    const bar = document.createElement("div");
    bar.className = "stage-bar";

    const heading = document.createElement("h2");
    heading.className = "stage-heading";

    const controls = document.createElement("div");
    controls.className = "stage-controls";

    const playButton = stageButton("Play", "btn btn-primary min-w-16 lg:min-w-20");
    playButton.setAttribute("aria-pressed", "false");

    const scroller = document.createElement("div");
    scroller.className = "stage-scroller";
    const sheet = document.createElement("div");
    sheet.className = "stage-sheet";
    scroller.appendChild(sheet);

    function applyFontSize(): void {
      sheet.style.fontSize = `${fontSize}px`;
    }

    function setPlaying(next: boolean): void {
      playing = next;
      playButton.textContent = playing ? "Pause" : "Play";
      playButton.setAttribute("aria-pressed", String(playing));
      if (playing) {
        lastTimestamp = null;
        frame = requestAnimationFrame(tick);
      } else {
        stopLoop();
      }
    }

    function tick(timestamp: number): void {
      if (!playing) return;
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        frame = requestAnimationFrame(tick);
        return;
      }
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = autoscrollStep(scroller.scrollTop, speed, delta, maxScrollTop);
      if (autoscrollAtEnd(scroller.scrollTop, maxScrollTop)) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    function close(): void {
      setPlaying(false);
      wakeLock.release();
      overlay.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
      if (lastFocused instanceof HTMLElement) {
        lastFocused.focus();
      }
    }

    function changeFontSize(step: number): void {
      fontSizeChosen = true;
      fontSize = clampFontSize(fontSize + step);
      applyFontSize();
    }

    playButton.addEventListener("click", () => setPlaying(!playing));

    const speedWrap = document.createElement("label");
    speedWrap.className = "stage-speed";
    const speedText = document.createElement("span");
    speedText.className = "max-sm:sr-only";
    speedText.textContent = "Speed";
    const speedInput = document.createElement("input");
    speedInput.type = "range";
    speedInput.min = String(AUTOSCROLL_MIN_SPEED);
    speedInput.max = String(AUTOSCROLL_MAX_SPEED);
    speedInput.value = String(speed);
    speedInput.className = "w-full min-w-10 accent-vermilion lg:w-32";
    speedInput.setAttribute("aria-label", "Autoscroll speed");
    speedInput.addEventListener("input", () => {
      speed = clampAutoscrollSpeed(Number(speedInput.value));
    });
    speedWrap.append(speedText, speedInput);

    const fontDown = stageButton("A−", "btn btn-square shrink-0 font-semibold");
    fontDown.setAttribute("aria-label", "Decrease font size");
    fontDown.addEventListener("click", () => changeFontSize(-FONT_STEP));
    const fontUp = stageButton("A+", "btn btn-square shrink-0 font-semibold");
    fontUp.setAttribute("aria-label", "Increase font size");
    fontUp.addEventListener("click", () => changeFontSize(FONT_STEP));

    const columnsButton = stageButton("2 columns", "btn stage-columns-toggle");
    columnsButton.setAttribute("aria-pressed", "false");
    columnsButton.addEventListener("click", () => {
      const columns = !sheet.hasAttribute("data-columns");
      sheet.toggleAttribute("data-columns", columns);
      columnsButton.setAttribute("aria-pressed", String(columns));
    });

    const themeButton = stageButton("", "btn btn-square shrink-0");
    function syncThemeToggle(): void {
      const next = resolvedScheme() === "dark" ? "light" : "dark";
      themeButton.innerHTML = next === "light" ? SUN_ICON : MOON_ICON;
      themeButton.dataset["next"] = next;
      themeButton.setAttribute("aria-label", `Switch to ${next} theme`);
      themeButton.title = `Switch to ${next} theme`;
    }
    themeButton.addEventListener("click", () => {
      setTheme(themeButton.dataset["next"] === "light" ? "light" : "dark");
    });
    document.addEventListener(THEME_CHANGE_EVENT, syncThemeToggle);

    const closeButton = stageButton("Close", "btn stage-close");
    closeButton.setAttribute("aria-label", "Close performance view");
    closeButton.addEventListener("click", close);

    const hint = document.createElement("p");
    hint.className = "stage-hint";
    hint.textContent = "Space play · + / − size · Esc close";

    controls.append(playButton, speedWrap, fontDown, fontUp, columnsButton, themeButton);
    bar.append(heading, hint, controls, closeButton);
    overlay.append(bar, scroller);
    document.body.appendChild(overlay);

    function trapFocus(event: KeyboardEvent): void {
      const focusable = [...overlay.querySelectorAll<HTMLElement>("button, input")].filter(
        isVisible
      );
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === overlay)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === "Tab") {
        trapFocus(event);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const fontStep = FONT_KEY_STEPS[event.key];
      if (event.key === " " && !isControl(event.target)) {
        event.preventDefault();
        setPlaying(!playing);
      } else if (fontStep !== undefined && event.target !== speedInput) {
        event.preventDefault();
        changeFontSize(fontStep);
      }
    });

    return { overlay, heading, sheet, scroller, applyFontSize, setPlaying, syncThemeToggle };
  }

  function open(text: string, headingText: string): void {
    if (elements === null) elements = build();
    const { overlay, heading, sheet, scroller, applyFontSize, setPlaying, syncThemeToggle } =
      elements;
    lastFocused = document.activeElement;
    heading.textContent = headingText;
    renderSheet(sheet, text);
    syncThemeToggle();
    setPlaying(false);
    overlay.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    if (!fontSizeChosen)
      fontSize = fittingFontSize(readableWidth(scroller), longestLineLength(text));
    applyFontSize();
    scroller.scrollTop = 0;
    wakeLock.acquire();
    overlay.tabIndex = -1;
    overlay.focus();
  }

  return { open };
}
