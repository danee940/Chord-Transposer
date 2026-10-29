import { renderDiagram } from "./render";
import type { Instrument, ParsedChord } from "./shapes";

export interface ChordPopover {
  show(triggerElement: HTMLElement, chord: ParsedChord | null): void;
  hide(): void;
}

interface PopoverElements {
  element: HTMLDivElement;
  content: HTMLDivElement;
}

export function createChordPopover(getInstrument: () => Instrument): ChordPopover {
  let popover: PopoverElements | null = null;
  let anchor: HTMLElement | null = null;

  function ensureElement(): PopoverElements {
    if (popover !== null) return popover;
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
    close.addEventListener("click", () => hide());

    const content = document.createElement("div");
    content.className = "chord-popover-content mt-2";

    element.appendChild(close);
    element.appendChild(content);
    document.body.appendChild(element);
    popover = { element, content };
    return popover;
  }

  function position(element: HTMLElement, trigger: HTMLElement): void {
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

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }
  }

  function onPointerdown(event: PointerEvent): void {
    const target = event.target as Node | null;
    if (popover!.element.contains(target) || target === anchor) return;
    hide();
  }

  function hide(): void {
    if (popover === null || popover.element.classList.contains("hidden")) return;
    popover.element.classList.add("hidden");
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("pointerdown", onPointerdown, true);
    const previous = anchor;
    anchor = null;
    if (previous) previous.focus();
  }

  function show(triggerElement: HTMLElement, chord: ParsedChord | null): void {
    const { element, content } = ensureElement();
    anchor = triggerElement;
    content.replaceChildren(renderDiagram(chord, getInstrument()));
    element.classList.remove("hidden");
    position(element, triggerElement);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("pointerdown", onPointerdown, true);
    const close = element.querySelector<HTMLButtonElement>(".chord-popover-close");
    if (close) close.focus();
  }

  return { show, hide };
}
