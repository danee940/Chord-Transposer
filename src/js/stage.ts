export const AUTOSCROLL_MIN_SPEED = 10;
export const AUTOSCROLL_MAX_SPEED = 240;
export const AUTOSCROLL_DEFAULT_SPEED = 60;

export interface StageView {
  open(text: string): void;
}

interface StageElements {
  overlay: HTMLDivElement;
  content: HTMLPreElement;
  scroller: HTMLDivElement;
  applyFontSize(): void;
  setPlaying(next: boolean): void;
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

export function createStageView(): StageView {
  let elements: StageElements | null = null;
  let fontSize = FONT_DEFAULT;
  let speed = AUTOSCROLL_DEFAULT_SPEED;
  let playing = false;
  let lastTimestamp: number | null = null;
  let frame: number | null = null;
  let lastFocused: Element | null = null;

  function stopLoop(): void {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    lastTimestamp = null;
  }

  function iconButton(label: string, extraClasses: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = `rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60 ${extraClasses}`;
    return button;
  }

  function build(): StageElements {
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 hidden flex-col bg-slate-950 text-slate-100";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Performance view");

    const bar = document.createElement("div");
    bar.className =
      "flex flex-wrap items-center gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur";

    const playButton = iconButton("Play", "");
    playButton.setAttribute("aria-pressed", "false");

    const scroller = document.createElement("div");
    scroller.className = "flex-1 overflow-auto px-6 py-8";
    const content = document.createElement("pre");
    content.className = "mx-auto max-w-4xl whitespace-pre font-mono leading-relaxed";
    scroller.appendChild(content);

    function applyFontSize(): void {
      content.style.fontSize = `${fontSize}px`;
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
      overlay.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
      if (lastFocused instanceof HTMLElement) {
        lastFocused.focus();
      }
    }

    playButton.addEventListener("click", () => setPlaying(!playing));

    const speedWrap = document.createElement("label");
    speedWrap.className = "flex items-center gap-2 text-sm text-slate-300";
    const speedText = document.createElement("span");
    speedText.textContent = "Speed";
    const speedInput = document.createElement("input");
    speedInput.type = "range";
    speedInput.min = String(AUTOSCROLL_MIN_SPEED);
    speedInput.max = String(AUTOSCROLL_MAX_SPEED);
    speedInput.value = String(speed);
    speedInput.className = "w-32 accent-accent";
    speedInput.setAttribute("aria-label", "Autoscroll speed");
    speedInput.addEventListener("input", () => {
      speed = clampAutoscrollSpeed(Number(speedInput.value));
    });
    speedWrap.append(speedText, speedInput);

    const fontDown = iconButton("A−", "font-semibold");
    fontDown.setAttribute("aria-label", "Decrease font size");
    fontDown.addEventListener("click", () => {
      fontSize = clampFontSize(fontSize - FONT_STEP);
      applyFontSize();
    });
    const fontUp = iconButton("A+", "font-semibold");
    fontUp.setAttribute("aria-label", "Increase font size");
    fontUp.addEventListener("click", () => {
      fontSize = clampFontSize(fontSize + FONT_STEP);
      applyFontSize();
    });

    const spacer = document.createElement("div");
    spacer.className = "flex-1";

    const closeButton = iconButton("Close", "");
    closeButton.setAttribute("aria-label", "Close performance view");
    closeButton.addEventListener("click", close);

    bar.append(playButton, speedWrap, fontDown, fontUp, spacer, closeButton);

    overlay.append(bar, scroller);
    document.body.appendChild(overlay);

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === " " && event.target === overlay) {
        event.preventDefault();
        setPlaying(!playing);
      }
    });

    return { overlay, content, scroller, applyFontSize, setPlaying };
  }

  function open(text: string): void {
    if (elements === null) elements = build();
    const { overlay, content, scroller, applyFontSize, setPlaying } = elements;
    lastFocused = document.activeElement;
    content.textContent = text;
    applyFontSize();
    scroller.scrollTop = 0;
    setPlaying(false);
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    overlay.tabIndex = -1;
    overlay.focus();
  }

  return { open };
}
