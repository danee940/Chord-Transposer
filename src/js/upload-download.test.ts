import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GENERIC_ERROR,
  changePairs,
  downloadBlob,
  errorDetails,
  parseDownloadFilename,
} from "./upload-download";

describe("errorDetails", () => {
  it("reads the message and per-file index", () => {
    expect(errorDetails({ error: "bad song", index: 2 })).toEqual({
      message: "bad song",
      index: 2,
    });
  });

  it("falls back for non-objects, blank messages and absent indexes", () => {
    expect(errorDetails(null)).toEqual({ message: GENERIC_ERROR, index: null });
    expect(errorDetails("nope")).toEqual({ message: GENERIC_ERROR, index: null });
    expect(errorDetails({ error: "" })).toEqual({ message: GENERIC_ERROR, index: null });
    expect(errorDetails({ error: "x", index: 1.5 })).toEqual({ message: "x", index: null });
  });
});

describe("parseDownloadFilename", () => {
  it("prefers the RFC 5987 extended form", () => {
    expect(parseDownloadFilename("attachment; filename*=UTF-8''s%C3%B6ng.docx", "f")).toBe(
      "söng.docx"
    );
  });

  it("falls back when the extended form is malformed", () => {
    expect(parseDownloadFilename("attachment; filename*=UTF-8''%E0%A4%A", "fallback")).toBe(
      "fallback"
    );
  });

  it("reads quoted and bare filenames", () => {
    expect(parseDownloadFilename('attachment; filename="song.docx"', "f")).toBe("song.docx");
    expect(parseDownloadFilename("attachment; filename=song.docx ", "f")).toBe("song.docx");
  });

  it("falls back on an empty disposition", () => {
    expect(parseDownloadFilename("", "fallback.pdf")).toBe("fallback.pdf");
  });
});

describe("changePairs", () => {
  it("splits a change header into before/after pairs", () => {
    expect(changePairs("C->D, G->A")).toEqual([
      ["C", "D"],
      ["G", "A"],
    ]);
  });

  it("keeps entries without an arrow and drops blanks", () => {
    expect(changePairs("none")).toEqual([["none", ""]]);
    expect(changePairs("")).toEqual([]);
  });
});

describe("downloadBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clicks a temporary anchor and revokes the object URL", () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "song.docx");

    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a")).toBeNull();
    vi.unstubAllGlobals();
  });
});
