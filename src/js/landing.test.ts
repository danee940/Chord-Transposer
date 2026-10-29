import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initCapo = vi.fn();
const initPaste = vi.fn();
const initSyncedPanes = vi.fn();
const initUpload = vi.fn();

vi.mock("./capo", () => ({ initCapo }));
vi.mock("./paste", () => ({ initPaste }));
vi.mock("./panes", () => ({ initSyncedPanes }));
vi.mock("./upload", () => ({ initUpload }));

describe("landing entry point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("initialises nothing when the landing widgets are absent", async () => {
    await import("./landing");
    expect(initPaste).not.toHaveBeenCalled();
    expect(initSyncedPanes).not.toHaveBeenCalled();
    expect(initCapo).not.toHaveBeenCalled();
    expect(initUpload).not.toHaveBeenCalled();
  });

  it("initialises the paste panel and capo table when present", async () => {
    document.body.innerHTML = `<div id="panel-paste"></div><div id="capo-key"></div>`;
    await import("./landing");
    expect(initPaste).toHaveBeenCalledOnce();
    expect(initSyncedPanes).toHaveBeenCalledOnce();
    expect(initCapo).toHaveBeenCalledOnce();
    expect(initUpload).not.toHaveBeenCalled();
  });

  it("initialises the upload panel on the file transposer page", async () => {
    document.body.innerHTML = `<form id="form"></form>`;
    await import("./landing");
    expect(initUpload).toHaveBeenCalledOnce();
    expect(initPaste).not.toHaveBeenCalled();
    expect(initCapo).not.toHaveBeenCalled();
  });
});
