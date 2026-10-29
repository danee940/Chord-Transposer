import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initSyncedPanes, scaledScrollTop } from "./panes";

function fakePane(scrollTop, scrollHeight, clientHeight) {
  return { scrollTop, scrollHeight, clientHeight };
}

describe("scaledScrollTop", () => {
  it("maps the scroll ratio onto the target range", () => {
    const source = fakePane(50, 200, 100);
    const target = fakePane(0, 400, 100);
    expect(scaledScrollTop(source, target)).toBe(150);
  });

  it("returns zero when the source cannot scroll", () => {
    expect(scaledScrollTop(fakePane(0, 100, 100), fakePane(0, 400, 100))).toBe(0);
  });

  it("returns zero when the target cannot scroll", () => {
    expect(scaledScrollTop(fakePane(50, 200, 100), fakePane(0, 100, 100))).toBe(0);
  });
});

describe("initSyncedPanes", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  function buildPanes(count) {
    document.body.innerHTML = "";
    const panes = [];
    for (let index = 0; index < count; index += 1) {
      const pane = document.createElement("div");
      pane.setAttribute("data-sync-scroll", "");
      Object.defineProperty(pane, "scrollHeight", { value: 400, configurable: true });
      Object.defineProperty(pane, "clientHeight", { value: 100, configurable: true });
      document.body.appendChild(pane);
      panes.push(pane);
    }
    return panes;
  }

  it("does nothing with fewer than two panes", () => {
    const [pane] = buildPanes(1);
    initSyncedPanes();
    pane.scrollTop = 100;
    pane.dispatchEvent(new Event("scroll"));
    expect(pane.scrollTop).toBe(100);
  });

  it("mirrors scrolling from one pane to the others", () => {
    const [first, second] = buildPanes(2);
    initSyncedPanes();
    first.scrollTop = 150;
    first.dispatchEvent(new Event("scroll"));
    expect(second.scrollTop).toBe(150);
  });

  it("ignores re-entrant scroll events while syncing", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    const [first, second] = buildPanes(2);
    initSyncedPanes();
    first.scrollTop = 150;
    first.dispatchEvent(new Event("scroll"));
    second.dispatchEvent(new Event("scroll"));
    expect(second.scrollTop).toBe(150);
  });
});
