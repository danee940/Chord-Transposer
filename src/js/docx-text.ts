const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCUMENT_PART = "word/document.xml";
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_COMMENT_LENGTH = 0xffff;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

interface ZipEntry {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

export class DocxReadError extends Error {}

function findEndOfCentralDirectory(view: DataView): number {
  const latest = view.byteLength - END_OF_CENTRAL_DIRECTORY_SIZE;
  const earliest = Math.max(0, latest - MAX_COMMENT_LENGTH);
  for (let offset = latest; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new DocxReadError("The file is not a .docx archive.");
}

function findEntry(bytes: Uint8Array<ArrayBuffer>, view: DataView, name: string): ZipEntry {
  const directoryEnd = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(directoryEnd + 10, true);
  const decoder = new TextDecoder();
  let offset = view.getUint32(directoryEnd + 16, true);
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new DocxReadError("The .docx archive directory is damaged.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (entryName === name) {
      return {
        method: view.getUint16(offset + 10, true),
        compressedSize: view.getUint32(offset + 20, true),
        localHeaderOffset: view.getUint32(offset + 42, true),
      };
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new DocxReadError("The .docx archive has no Word document inside.");
}

function entryData(
  bytes: Uint8Array<ArrayBuffer>,
  view: DataView,
  entry: ZipEntry
): Uint8Array<ArrayBuffer> {
  const header = entry.localHeaderOffset;
  if (view.getUint32(header, true) !== LOCAL_HEADER_SIGNATURE) {
    throw new DocxReadError("The .docx archive entry is damaged.");
  }
  const nameLength = view.getUint16(header + 26, true);
  const extraLength = view.getUint16(header + 28, true);
  const start = header + 30 + nameLength + extraLength;
  return bytes.subarray(start, start + entry.compressedSize);
}

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const inflated = source.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(inflated).arrayBuffer());
}

async function decodeEntry(
  bytes: Uint8Array<ArrayBuffer>,
  view: DataView,
  entry: ZipEntry
): Promise<string> {
  const data = entryData(bytes, view, entry);
  if (entry.method === METHOD_STORED) return new TextDecoder().decode(data);
  if (entry.method === METHOD_DEFLATED) return new TextDecoder().decode(await inflate(data));
  throw new DocxReadError("The .docx archive uses an unsupported compression method.");
}

export function nodeText(node: Node): string {
  return node.textContent ?? "";
}

function isWordElement(node: Element, localName: string): boolean {
  return node.namespaceURI === WORD_NAMESPACE && node.localName === localName;
}

function breakText(element: Element): string {
  const type = element.getAttributeNS(WORD_NAMESPACE, "type");
  return type === null || type === "textWrapping" ? "\n" : "";
}

function runText(run: Element): string {
  let text = "";
  for (const child of run.children) {
    if (child.namespaceURI !== WORD_NAMESPACE) continue;
    switch (child.localName) {
      case "t":
        text += nodeText(child);
        break;
      case "tab":
      case "ptab":
        text += "\t";
        break;
      case "br":
        text += breakText(child);
        break;
      case "cr":
        text += "\n";
        break;
      case "noBreakHyphen":
        text += "-";
        break;
      default:
        break;
    }
  }
  return text;
}

function paragraphText(paragraph: Element): string {
  let text = "";
  for (const child of paragraph.children) {
    if (isWordElement(child, "r")) {
      text += runText(child);
    } else if (isWordElement(child, "hyperlink")) {
      for (const run of child.children) {
        if (isWordElement(run, "r")) text += runText(run);
      }
    }
  }
  return text;
}

function insideTextBox(element: Element): boolean {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (isWordElement(node, "txbxContent")) return true;
  }
  return false;
}

export function documentParagraphs(xml: string): string[] {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  return [...parsed.getElementsByTagNameNS(WORD_NAMESPACE, "p")]
    .filter((paragraph) => !insideTextBox(paragraph))
    .map(paragraphText);
}

export async function extractDocxParagraphs(buffer: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entry = findEntry(bytes, view, DOCUMENT_PART);
  return documentParagraphs(await decodeEntry(bytes, view, entry));
}
