import { describe, expect, it } from "vitest";

import {
  DocxReadError,
  detectionParagraphs,
  documentParagraphs,
  extractDocx,
  nodeText,
} from "./docx-text";
import { buildDocx, buildZip, documentXml, paragraphsXml, storyXml } from "./testing/docx-fixture";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";

async function deflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const compressed = source.pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

function encode(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

function toBuffer(bytes: Uint8Array<ArrayBuffer>): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function textBox(lines: string[]): string {
  const content = `<w:txbxContent>${paragraphsXml(lines)}</w:txbxContent>`;
  return (
    `<w:p><w:r><mc:AlternateContent xmlns:mc="${MC}"><mc:Choice Requires="wps">` +
    `<w:drawing>${content}</w:drawing></mc:Choice>` +
    `<mc:Fallback><w:pict>${content}</w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`
  );
}

describe("extractDocx", () => {
  it("reads body paragraphs in document order and uses them for detection", async () => {
    const sheet = await extractDocx(toBuffer(buildDocx(["C G Am F", "lyrics"])));
    expect(sheet.paragraphs).toEqual(["C G Am F", "lyrics"]);
    expect(sheet.detectionText).toBe("C G Am F\nlyrics");
  });

  it("inflates deflated document parts", async () => {
    const zip = buildZip(
      [{ name: "word/document.xml", data: await deflate(encode(documentXml(["D A"]))), method: 8 }],
      "trailing comment"
    );
    expect((await extractDocx(toBuffer(zip))).paragraphs).toEqual(["D A"]);
  });

  it("adds headers, footers and notes to the detection text but not to the preview", async () => {
    const docx = buildDocx(["Amazing grace, how sweet the sound"], {
      "word/header1.xml": storyXml("hdr", paragraphsXml(["G C D G"])),
      "word/footer2.xml": storyXml("ftr", paragraphsXml(["Em C D7 G"])),
      "word/footnotes.xml": storyXml("footnotes", paragraphsXml(["G7"])),
      "word/endnotes.xml": storyXml("endnotes", paragraphsXml(["Cmaj7"])),
      "word/styles.xml": storyXml("styles", paragraphsXml(["not a story part"])),
    });
    const sheet = await extractDocx(toBuffer(docx));
    expect(sheet.paragraphs).toEqual(["Amazing grace, how sweet the sound"]);
    expect(sheet.detectionText).toBe(
      "Amazing grace, how sweet the sound\nG C D G\nEm C D7 G\nG7\nCmaj7"
    );
  });

  it("counts a text box once for detection and leaves it out of the preview", async () => {
    const body = `<w:body>${paragraphsXml(["lyrics"])}${textBox(["G C D G"])}</w:body>`;
    const zip = buildZip([
      { name: "word/document.xml", data: encode(storyXml("document", body)), method: 0 },
    ]);
    const sheet = await extractDocx(toBuffer(zip));
    expect(sheet.paragraphs).toEqual(["lyrics", ""]);
    expect(sheet.detectionText).toBe("lyrics\n\nG C D G");
  });

  it("rejects files without an end-of-directory record", async () => {
    await expect(extractDocx(toBuffer(encode("plain text")))).rejects.toBeInstanceOf(DocxReadError);
  });

  it("rejects archives without a Word document", async () => {
    const zip = buildZip([{ name: "other.xml", data: encode("<a/>"), method: 0 }]);
    await expect(extractDocx(toBuffer(zip))).rejects.toThrow("no Word document");
  });

  it("rejects a damaged central directory", async () => {
    const zip = buildZip([{ name: "word/document.xml", data: encode("<a/>"), method: 0 }]);
    const view = new DataView(zip.buffer);
    const directoryOffset = view.getUint32(zip.length - 22 + 16, true);
    view.setUint32(directoryOffset, 0, true);
    await expect(extractDocx(toBuffer(zip))).rejects.toThrow("directory is damaged");
  });

  it("rejects a damaged local header", async () => {
    const zip = buildZip([{ name: "word/document.xml", data: encode("<a/>"), method: 0 }]);
    new DataView(zip.buffer).setUint32(0, 0, true);
    await expect(extractDocx(toBuffer(zip))).rejects.toThrow("entry is damaged");
  });

  it("rejects unsupported compression methods", async () => {
    const zip = buildZip([{ name: "word/document.xml", data: encode("<a/>"), method: 12 }]);
    await expect(extractDocx(toBuffer(zip))).rejects.toThrow("unsupported compression");
  });
});

describe("documentParagraphs", () => {
  function xml(body: string): string {
    return `<w:document xmlns:w="${W}" xmlns:x="urn:x"><w:body>${body}</w:body></w:document>`;
  }

  it("maps tabs, breaks and hyphens like python-docx", () => {
    const body =
      "<w:p><w:r><w:rPr/><w:t>D</w:t><w:tab/><w:t>A</w:t><w:br/><w:t>Bm</w:t><w:ptab/>" +
      '<w:br w:type="page"/><w:cr/><w:noBreakHyphen/><x:t>ignored</x:t></w:r></w:p>';
    expect(documentParagraphs(xml(body))).toEqual(["D\tA\nBm\t\n-"]);
  });

  it("includes hyperlink runs and skips other paragraph children", () => {
    const body =
      "<w:p><w:pPr/><w:r><w:t>See </w:t></w:r>" +
      "<w:hyperlink><w:rPr/><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>";
    expect(documentParagraphs(xml(body))).toEqual(["See link"]);
  });

  it("includes table cells but not text boxes", () => {
    const body =
      "<w:p><w:r><w:t>Verse</w:t></w:r></w:p>" +
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>" +
      "<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>Boxed</w:t></w:r></w:p>" +
      "</w:txbxContent></w:pict></w:r></w:p>";
    expect(documentParagraphs(xml(body))).toEqual(["Verse", "Cell", ""]);
  });

  it("returns no paragraphs for malformed XML", () => {
    expect(documentParagraphs("<not xml")).toEqual([]);
  });
});

describe("detectionParagraphs", () => {
  it("includes text boxes but skips the legacy fallback copy of a drawing", () => {
    const xml = storyXml("document", `<w:body>${textBox(["Am F C G"])}</w:body>`);
    expect(detectionParagraphs(xml)).toEqual(["", "Am F C G"]);
  });
});

describe("nodeText", () => {
  it("treats a node without text content as empty", () => {
    expect(nodeText(new DOMParser().parseFromString("<a/>", "application/xml"))).toBe("");
  });
});
