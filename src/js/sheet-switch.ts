const SHEET_VIEWS = ["input", "output"] as const;

type SheetView = (typeof SHEET_VIEWS)[number];

function isSheetView(value: unknown): value is SheetView {
  return (SHEET_VIEWS as readonly unknown[]).includes(value);
}

export function initSheetSwitches(): void {
  document.querySelectorAll<HTMLElement>("[data-sheets]").forEach((sheets) => {
    const options = [...sheets.querySelectorAll<HTMLButtonElement>("button[data-sheet-view]")];

    function show(view: SheetView): void {
      sheets.dataset["sheets"] = view;
      for (const option of options) {
        option.setAttribute("aria-pressed", String(option.dataset["sheetView"] === view));
      }
    }

    for (const option of options) {
      const view = option.dataset["sheetView"];
      if (isSheetView(view)) option.addEventListener("click", () => show(view));
    }
  });
}
