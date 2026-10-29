import { ACTIVE_TAB_CLASSES, INACTIVE_TAB_CLASSES, requireElement } from "./dom";

type Tab = "paste" | "upload";

export function initTabs(): void {
  const tabPaste = requireElement("tab-paste");
  const tabUpload = requireElement("tab-upload");
  const panelPaste = requireElement("panel-paste");
  const panelUpload = requireElement("panel-upload");

  function selectTab(active: Tab): void {
    const paste = active === "paste";
    tabPaste.setAttribute("aria-selected", String(paste));
    tabUpload.setAttribute("aria-selected", String(!paste));
    panelPaste.classList.toggle("hidden", !paste);
    panelUpload.classList.toggle("hidden", paste);
    tabPaste.classList.remove(...ACTIVE_TAB_CLASSES, ...INACTIVE_TAB_CLASSES);
    tabUpload.classList.remove(...ACTIVE_TAB_CLASSES, ...INACTIVE_TAB_CLASSES);
    tabPaste.classList.add(...(paste ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES));
    tabUpload.classList.add(...(paste ? INACTIVE_TAB_CLASSES : ACTIVE_TAB_CLASSES));
  }

  tabPaste.addEventListener("click", () => selectTab("paste"));
  tabUpload.addEventListener("click", () => selectTab("upload"));
  selectTab("paste");
}
