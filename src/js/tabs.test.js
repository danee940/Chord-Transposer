import { beforeEach, describe, expect, it } from "vitest";

import { initTabs } from "./tabs";

function setupDom() {
  document.body.innerHTML = `
    <button id="tab-paste"></button>
    <button id="tab-upload"></button>
    <div id="panel-paste"></div>
    <div id="panel-upload"></div>
  `;
}

describe("initTabs", () => {
  beforeEach(setupDom);

  it("selects the paste tab by default", () => {
    initTabs();
    expect(document.getElementById("tab-paste").getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("tab-upload").getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("panel-paste").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("panel-upload").classList.contains("hidden")).toBe(true);
  });

  it("switches to the upload tab on click", () => {
    initTabs();
    document.getElementById("tab-upload").dispatchEvent(new Event("click"));
    expect(document.getElementById("tab-upload").getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("panel-upload").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("panel-paste").classList.contains("hidden")).toBe(true);
  });

  it("switches back to the paste tab on click", () => {
    initTabs();
    document.getElementById("tab-upload").dispatchEvent(new Event("click"));
    document.getElementById("tab-paste").dispatchEvent(new Event("click"));
    expect(document.getElementById("tab-paste").getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("panel-paste").classList.contains("hidden")).toBe(false);
  });
});
