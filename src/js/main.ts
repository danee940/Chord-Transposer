import { initCapo } from "./capo";
import { initSyncedPanes } from "./panes";
import { initPaste } from "./paste";
import { initSheetSwitches } from "./sheet-switch";
import { initTabs } from "./tabs";
import { initThemeSwitch } from "./theme";
import { initUpload } from "./upload";

initThemeSwitch();
initUpload();
initTabs();
initPaste();
if (document.getElementById("capo-key")) initCapo();
initSyncedPanes();
initSheetSwitches();
