import { initCapo } from "./capo";
import { initSyncedPanes } from "./panes";
import { initPaste } from "./paste";
import { initUpload } from "./upload";

if (document.getElementById("panel-paste")) {
  initPaste();
  initSyncedPanes();
}
if (document.getElementById("form")) initUpload();
if (document.getElementById("capo-key")) initCapo();
