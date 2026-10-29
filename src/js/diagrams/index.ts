import { buildInteractiveOutput } from "./output";
import { createChordPopover } from "./popover";
import { parseChordSymbol, type Instrument } from "./shapes";

export interface Diagrams {
  renderInto(container: Element, text: string): void;
  closePopover(): void;
}

export function initDiagrams(getInstrument: () => Instrument): Diagrams {
  const popover = createChordPopover(getInstrument);

  function activate(button: HTMLButtonElement, chordSymbol: string, german: boolean): void {
    popover.show(button, parseChordSymbol(chordSymbol, german));
  }

  function renderInto(container: Element, text: string): void {
    popover.hide();
    container.replaceChildren(buildInteractiveOutput(text, activate));
  }

  return { renderInto, closePopover: popover.hide };
}
