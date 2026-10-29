import { beforeEach, describe, expect, it } from "vitest";

import { requireElement } from "./dom";
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
    expect(requireElement<HTMLButtonElement>("tab-paste").getAttribute("aria-selected")).toBe("true");
    expect(requireElement<HTMLButtonElement>("tab-upload").getAttribute("aria-selected")).toBe("false");
    expect(requireElement("panel-paste").classList.contains("hidden")).toBe(false);
    expect(requireElement("panel-upload").classList.contains("hidden")).toBe(true);
  });

  it("switches to the upload tab on click", () => {
    initTabs();
    requireElement<HTMLButtonElement>("tab-upload").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLButtonElement>("tab-upload").getAttribute("aria-selected")).toBe("true");
    expect(requireElement("panel-upload").classList.contains("hidden")).toBe(false);
    expect(requireElement("panel-paste").classList.contains("hidden")).toBe(true);
  });

  it("switches back to the paste tab on click", () => {
    initTabs();
    requireElement<HTMLButtonElement>("tab-upload").dispatchEvent(new Event("click"));
    requireElement<HTMLButtonElement>("tab-paste").dispatchEvent(new Event("click"));
    expect(requireElement<HTMLButtonElement>("tab-paste").getAttribute("aria-selected")).toBe("true");
    expect(requireElement("panel-paste").classList.contains("hidden")).toBe(false);
  });
});
