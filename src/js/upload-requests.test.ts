import { beforeEach, describe, expect, it } from "vitest";

import { requireElement } from "./dom";
import { buildBinderRequest, buildSingleRequest, type RequestContext } from "./upload-requests";

function docxFileNamed(name: string): File {
  return new File(["body"], name);
}

function context(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    form: requireElement<HTMLFormElement>("form"),
    from: "C",
    to: "D",
    notation: undefined,
    format: "docx",
    ...overrides,
  };
}

function fields(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    out[key] = value instanceof File ? value.name : value;
  }
  return out;
}

beforeEach(() => {
  document.body.innerHTML = `
    <form id="form">
      <input name="current_key" value="C" />
      <input name="target_key" value="D" />
    </form>`;
});

describe("buildBinderRequest", () => {
  it("posts every file to /binder with the keys", () => {
    const files = [docxFileNamed("a.docx"), docxFileNamed("b.docx")];
    const request = buildBinderRequest(files, context());

    expect(request.endpoint).toBe("/binder");
    expect(request.multi).toBe(true);
    expect(request.fallback).toBe("chord_binder.pdf");
    expect(request.body.getAll("files")).toHaveLength(2);
    expect(fields(request.body)["current_key"]).toBe("C");
  });

  it("carries a notation override", () => {
    const request = buildBinderRequest([docxFileNamed("a.docx")], context({ notation: true }));
    expect(fields(request.body)["notation"]).toBe("german");
  });

  it("never carries preview edits", () => {
    const request = buildBinderRequest([docxFileNamed("a.docx")], context());
    expect(request.body.has("edits")).toBe(false);
  });
});

describe("buildSingleRequest for .docx", () => {
  it("posts the whole form to /transpose", () => {
    const request = buildSingleRequest(docxFileNamed("song.docx"), [], context());
    expect(request.endpoint).toBe("/transpose");
    expect(request.multi).toBe(false);
    expect(request.fallback).toBe("transposed.docx");
    expect(fields(request.body)["target_key"]).toBe("D");
  });

  it("uses the selected format for the fallback name", () => {
    const request = buildSingleRequest(docxFileNamed("song.docx"), [], context({ format: "pdf" }));
    expect(request.fallback).toBe("transposed.pdf");
  });

  it("serialises preview edits", () => {
    const edits = [{ index: 0, source: "C G", text: "D A" }];
    const request = buildSingleRequest(docxFileNamed("song.docx"), edits, context());
    expect(JSON.parse(fields(request.body)["edits"]!)).toEqual(edits);
  });

  it("sends english when the reader forces that notation", () => {
    const request = buildSingleRequest(
      docxFileNamed("song.docx"),
      [],
      context({ notation: false })
    );
    expect(fields(request.body)["notation"]).toBe("english");
  });
});

describe("buildSingleRequest for text sheets", () => {
  it("posts to /transpose-text keeping the native format", () => {
    const request = buildSingleRequest(docxFileNamed("song.cho"), [], context());
    const sent = fields(request.body);
    expect(request.endpoint).toBe("/transpose-text");
    expect(sent["format"]).toBe("chordpro");
    expect(sent["file"]).toBe("song.cho");
    expect(request.fallback).toBe("transposed.pro");
  });

  it("honours a pdf selection over the native format", () => {
    const request = buildSingleRequest(docxFileNamed("song.txt"), [], context({ format: "pdf" }));
    expect(fields(request.body)["format"]).toBe("pdf");
    expect(request.fallback).toBe("transposed.pdf");
  });

  it("carries edits and notation", () => {
    const edits = [{ index: 1, source: "G", text: "A" }];
    const request = buildSingleRequest(
      docxFileNamed("song.txt"),
      edits,
      context({ notation: true })
    );
    const sent = fields(request.body);
    expect(sent["notation"]).toBe("german");
    expect(JSON.parse(sent["edits"]!)).toEqual(edits);
  });
});
