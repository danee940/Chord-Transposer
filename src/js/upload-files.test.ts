import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  TEXT_FORMAT_EXTENSIONS,
  isDocxName,
  isTextName,
  nativeTextFormat,
  originalFormatLabel,
  validateFile,
} from "./upload-files";

function file(name: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)]);
  return new File([blob], name);
}

describe("isTextName / isDocxName", () => {
  it.each([".txt", ".pro", ".cho"])("accepts %s as text", (ext) => {
    expect(isTextName(`song${ext}`)).toBe(true);
    expect(isDocxName(`song${ext}`)).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isTextName("SONG.TXT")).toBe(true);
    expect(isDocxName("SONG.DOCX")).toBe(true);
  });

  it("rejects unrelated extensions", () => {
    expect(isTextName("song.pdf")).toBe(false);
    expect(isDocxName("song.doc")).toBe(false);
  });
});

describe("validateFile", () => {
  it("accepts a normal .docx", () => {
    expect(validateFile(file("song.docx", 1024))).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(validateFile(file("song.pdf", 1024))).toMatch(/Unsupported file type/);
  });

  it("rejects an empty file", () => {
    expect(validateFile(file("song.docx", 0))).toMatch(/empty/);
  });

  it("rejects a file over the size limit", () => {
    expect(validateFile(file("song.docx", MAX_UPLOAD_BYTES + 1))).toMatch(/too large/);
  });
});

describe("output format naming", () => {
  it("keeps .txt native but maps ChordPro extensions to chordpro", () => {
    expect(nativeTextFormat("song.txt")).toBe("txt");
    expect(nativeTextFormat("song.cho")).toBe("chordpro");
    expect(nativeTextFormat("song.pro")).toBe("chordpro");
  });

  it("labels the original format of a selection", () => {
    expect(originalFormatLabel("song.txt")).toBe(".txt");
    expect(originalFormatLabel("song.cho")).toBe(".pro");
    expect(originalFormatLabel("song.docx")).toBe(".docx");
    expect(originalFormatLabel("")).toBe(".docx");
  });

  it("maps each format to a download extension", () => {
    expect(TEXT_FORMAT_EXTENSIONS).toEqual({ pdf: "pdf", txt: "txt", chordpro: "pro" });
  });
});
