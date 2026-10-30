import { pluralise } from "./dom";

export interface ChangesDisclosureElements {
  wrap: HTMLElement;
  toggle: HTMLElement;
  label: HTMLElement;
  caret: HTMLElement;
  list: HTMLElement;
}

export interface ChangesDisclosure {
  show(rows: readonly Node[]): void;
  hide(): void;
}

export function createChangesDisclosure({
  wrap,
  toggle,
  label,
  caret,
  list,
}: ChangesDisclosureElements): ChangesDisclosure {
  let count = 0;

  function setExpanded(expanded: boolean): void {
    list.classList.toggle("hidden", !expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    caret.classList.toggle("rotate-90", expanded);
    label.textContent = `${expanded ? "Hide" : "Show"} ${pluralise(count, "chord change")}`;
  }

  toggle.addEventListener("click", () => {
    setExpanded(list.classList.contains("hidden"));
  });

  return {
    show(rows: readonly Node[]): void {
      count = rows.length;
      list.replaceChildren(...rows);
      wrap.classList.remove("hidden");
      setExpanded(false);
    },
    hide(): void {
      count = 0;
      list.replaceChildren();
      wrap.classList.add("hidden");
      setExpanded(false);
    },
  };
}
