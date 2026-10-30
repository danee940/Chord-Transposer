import { describe, expect, it } from "vitest";

import { alignEditedParagraphs, lineCount, regroupLines } from "./preview-edits";

describe("lineCount", () => {
  it("counts newline-separated lines", () => {
    expect(lineCount("")).toBe(1);
    expect(lineCount("a\nb\nc")).toBe(3);
  });
});

describe("regroupLines", () => {
  it("splits text back into paragraphs with the template's line counts", () => {
    expect(regroupLines("a\nb\nc\nd", ["x\ny", "z", "w"])).toEqual(["a\nb", "c", "d"]);
  });
});

describe("alignEditedParagraphs", () => {
  const generated = ["D A Bm G", "Amazing grace", "D A\nBm G", ""];

  it("returns the paragraphs unchanged when nothing was edited", () => {
    expect(alignEditedParagraphs(generated, generated.join("\n"))).toEqual(generated);
  });

  it("keeps an edited line in its own paragraph", () => {
    const edited = "D A Bm7 G\nAmazing grace\nD A\nBm G\n";
    expect(alignEditedParagraphs(generated, edited)).toEqual([
      "D A Bm7 G",
      "Amazing grace",
      "D A\nBm G",
      "",
    ]);
  });

  it("attaches an inserted line to the paragraph it follows", () => {
    const edited = "D A Bm G\nAmazing grace\nhow sweet\nD A\nBm G\n";
    expect(alignEditedParagraphs(generated, edited)).toEqual([
      "D A Bm G",
      "Amazing grace\nhow sweet",
      "D A\nBm G",
      "",
    ]);
  });

  it("attaches lines inserted at the very start to the first paragraph", () => {
    const edited = "Verse 1\nD A Bm G\nAmazing grace\nD A\nBm G\n";
    expect(alignEditedParagraphs(generated, edited)).toEqual([
      "Verse 1\nD A Bm G",
      "Amazing grace",
      "D A\nBm G",
      "",
    ]);
  });

  it("empties a paragraph whose lines were all removed", () => {
    const edited = "D A Bm G\nD A\nBm G\n";
    expect(alignEditedParagraphs(generated, edited)).toEqual(["D A Bm G", "", "D A\nBm G", ""]);
  });

  it("spreads a rewritten block over the paragraphs it replaced", () => {
    const edited = "D A Bm7 G\nAmazing grace, how sweet\nthe sound\nD A\nBm G\n";
    expect(alignEditedParagraphs(generated, edited)).toEqual([
      "D A Bm7 G",
      "Amazing grace, how sweet\nthe sound",
      "D A\nBm G",
      "",
    ]);
  });

  it("gives a shorter rewritten block to the first paragraphs it replaced", () => {
    const edited = "rewritten\nD A\nBm G\n";
    expect(alignEditedParagraphs(generated, edited)).toEqual(["rewritten", "", "D A\nBm G", ""]);
  });

  it("appends trailing new lines to the last paragraph", () => {
    const edited = "D A Bm G\nAmazing grace\nD A\nBm G\n\nOutro";
    expect(alignEditedParagraphs(generated, edited)).toEqual([
      "D A Bm G",
      "Amazing grace",
      "D A\nBm G",
      "\nOutro",
    ]);
  });

  it("anchors on unchanged lines inside a changed region", () => {
    const paragraphs = ["intro", "C G", "lyrics", "Am F", "outro"];
    const edited = "intro\nD A\nlyrics\nBm G\nG\noutro";
    expect(alignEditedParagraphs(paragraphs, edited)).toEqual([
      "intro",
      "D A",
      "lyrics",
      "Bm G\nG",
      "outro",
    ]);
  });

  it("walks the diff table in both directions", () => {
    expect(alignEditedParagraphs(["x", "k"], "k\ny")).toEqual(["", "k\ny"]);
    expect(alignEditedParagraphs(["k", "x"], "y\nk")).toEqual(["y\nk", ""]);
  });

  it("aligns positionally when the differing region is too large to diff", () => {
    const big = Array.from({ length: 2100 }, (_, index) => `line ${index}`);
    const edited = big.map((line) => `${line}!`);
    edited.splice(1000, 0, "inserted");
    const aligned = alignEditedParagraphs(big, edited.join("\n"));
    expect(aligned).toHaveLength(2100);
    expect(aligned[0]).toBe("line 0!");
    expect(aligned[1000]).toBe("inserted");
    expect(aligned[2099]).toBe("line 2098!\nline 2099!");
    expect(aligned.join("\n")).toBe(edited.join("\n"));
  });

  it("prefers keeping later lines matched when an earlier one is dropped", () => {
    expect(alignEditedParagraphs(["a", "b", "c"], "b\nc")).toEqual(["", "b", "c"]);
    expect(alignEditedParagraphs(["a", "b", "c"], "a\nc")).toEqual(["a", "", "c"]);
  });
});
