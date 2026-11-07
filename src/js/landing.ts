import { initCapo } from "./capo";
import { initSyncedPanes } from "./panes";
import { initPaste } from "./paste";
import { initSheetSwitches } from "./sheet-switch";
import { initThemeSwitch } from "./theme";
import { initUpload } from "./upload";

initThemeSwitch();
if (document.getElementById("panel-paste")) {
  initPaste();
  initSyncedPanes();
  initSheetSwitches();
}
if (document.getElementById("form")) initUpload();
if (document.getElementById("capo-key")) initCapo();
