import { renderDiagram } from "./render";
import type { Instrument, ParsedChord } from "./shapes";

export interface ChordPopover {
  show(triggerElement: HTMLElement, chord: ParsedChord | null): void;
  hide(): void;
}

function buildPopoverElement(onClose: () => void): {
  element: HTMLDivElement;
  content: HTMLDivElement;
} {
  const element = document.createElement("div");
  element.className =
    "chord-popover absolute z-50 hidden w-max max-w-xs rounded-xl border border-app-border-light bg-card-light p-3 shadow-lg dark:border-app-border dark:bg-card";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-label", "Chord fingering");

  const close = document.createElement("button");
  close.type = "button";
  close.className =
    "chord-popover-close absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-light transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent dark:text-muted dark:hover:text-slate-100";
  close.setAttribute("aria-label", "Close chord diagram");
  close.textContent = "×";
  close.addEventListener("click", onClose);

  const content = document.createElement("div");
  content.className = "chord-popover-content mt-2";

  element.append(close, content);
  return { element, content };
}

function positionBelowOrAbove(element: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect();
  const popRect = element.getBoundingClientRect();
  let left = window.scrollX + rect.left + rect.width / 2 - popRect.width / 2;
  left = Math.max(
    window.scrollX + 8,
    Math.min(left, window.scrollX + window.innerWidth - popRect.width - 8)
  );
  let top = window.scrollY + rect.bottom + 8;
  if (rect.bottom + popRect.height + 8 > window.innerHeight) {
    top = window.scrollY + rect.top - popRect.height - 8;
  }
  element.style.left = `${Math.round(left)}px`;
  element.style.top = `${Math.round(top)}px`;
}

export function createChordPopover(getInstrument: () => Instrument): ChordPopover {
  const { element, content } = buildPopoverElement(() => hide());
  let anchor: HTMLElement | null = null;

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }
  }

  function onPointerdown(event: PointerEvent): void {
    const target = event.target;
    if ((target instanceof Node && element.contains(target)) || target === anchor) return;
    hide();
  }

  function hide(): void {
    if (element.classList.contains("hidden")) return;
    element.classList.add("hidden");
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("pointerdown", onPointerdown, true);
    const previous = anchor;
    anchor = null;
    if (previous) previous.focus();
  }

  function show(triggerElement: HTMLElement, chord: ParsedChord | null): void {
    if (!element.isConnected) document.body.appendChild(element);
    anchor = triggerElement;
    content.replaceChildren(renderDiagram(chord, getInstrument()));
    element.classList.remove("hidden");
    positionBelowOrAbove(element, triggerElement);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("pointerdown", onPointerdown, true);
    element.querySelector<HTMLButtonElement>(".chord-popover-close")?.focus();
  }

  return { show, hide };
}
