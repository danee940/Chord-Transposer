import { afterEach, describe, expect, it, vi } from "vitest";

const initUpload = vi.fn();
const initTabs = vi.fn();
const initPaste = vi.fn();
const initCapo = vi.fn();
const initSyncedPanes = vi.fn();

vi.mock("./upload", () => ({ initUpload }));
vi.mock("./tabs", () => ({ initTabs }));
vi.mock("./paste", () => ({ initPaste }));
vi.mock("./capo", () => ({ initCapo }));
vi.mock("./panes", () => ({ initSyncedPanes }));

describe("main entry point", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("wires up every feature on load", async () => {
    await import("./main");
    expect(initUpload).toHaveBeenCalledOnce();
    expect(initTabs).toHaveBeenCalledOnce();
    expect(initPaste).toHaveBeenCalledOnce();
    expect(initSyncedPanes).toHaveBeenCalledOnce();
  });

  it("skips the capo table when the capo widget is absent", async () => {
    await import("./main");
    expect(initCapo).not.toHaveBeenCalled();
  });

  it("initialises the capo table when the capo widget is present", async () => {
    document.body.innerHTML = `<div id="capo-key"></div>`;
    await import("./main");
    expect(initCapo).toHaveBeenCalledOnce();
  });
});
