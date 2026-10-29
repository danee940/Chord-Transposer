import { initCapo } from "./capo";
import { initSyncedPanes } from "./panes";
import { initPaste } from "./paste";
import { initTabs } from "./tabs";
import { initUpload } from "./upload";

initUpload();
initTabs();
initPaste();
if (document.getElementById("capo-key")) initCapo();
initSyncedPanes();
