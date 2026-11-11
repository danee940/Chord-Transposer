import { formatCapoSuggestion } from "./capo-suggest";
import type { ChangesDisclosure } from "./changes-disclosure";
import type { ChangePair } from "./paste-result";

export interface PasteOutputElements {
  output: HTMLElement;
  status: HTMLElement;
  copy: HTMLButtonElement;
  stage: HTMLButtonElement;
  capoSuggestion: HTMLElement;
}

export interface PasteOutputOptions {
  elements: PasteOutputElements;
  changes: ChangesDisclosure;
  renderInto(target: HTMLElement, text: string): void;
  capoApplies(): boolean;
  targetKey(): string;
}

export interface PasteOutput {
  render(text: string, transposed: boolean): void;
  clear(): void;
  hasOutput(): boolean;
  text(): string;
  setStatus(text: string): void;
  showChanges(pairs: readonly ChangePair[]): void;
  hideChanges(): void;
  syncControls(): void;
  updateCapo(): void;
}

function changePill({ from, to }: ChangePair): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.className = "change-chip";
  pill.textContent = `${from} → ${to}`;
  return pill;
}

export function createPasteOutput({
  elements,
  changes,
  renderInto,
  capoApplies,
  targetKey,
}: PasteOutputOptions): PasteOutput {
  const { output, status, copy, stage, capoSuggestion } = elements;
  let renderedText = "";

  function hasOutput(): boolean {
    return renderedText.trim() !== "";
  }

  function updateCapo(): void {
    const message = capoApplies() ? formatCapoSuggestion(targetKey()) : null;
    if (message !== null && hasOutput()) {
      capoSuggestion.textContent = message;
      capoSuggestion.classList.remove("hidden");
    } else {
      capoSuggestion.textContent = "";
      capoSuggestion.classList.add("hidden");
    }
  }

  return {
    render(text: string, transposed: boolean): void {
      renderedText = text;
      renderInto(output, text);
      output.toggleAttribute("data-unchanged", !transposed);
      copy.disabled = text === "";
    },
    clear(): void {
      renderedText = "";
      output.textContent = "";
      copy.disabled = true;
    },
    hasOutput,
    text(): string {
      return renderedText;
    },
    setStatus(text: string): void {
      status.textContent = text;
    },
    showChanges(pairs: readonly ChangePair[]): void {
      if (pairs.length === 0) {
        changes.hide();
        return;
      }
      changes.show(pairs.map(changePill));
    },
    hideChanges(): void {
      changes.hide();
    },
    syncControls(): void {
      stage.disabled = !hasOutput();
      updateCapo();
    },
    updateCapo,
  };
}
