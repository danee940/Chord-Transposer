import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;
const METHOD_STORED = 0;
const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function endOfCentralDirectory(zip: Buffer): number {
  for (let offset = zip.length - END_OF_CENTRAL_DIRECTORY_SIZE; offset >= 0; offset -= 1) {
    if (zip.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error("Not a zip archive.");
}

export function readZipEntry(zip: Buffer, name: string): Buffer {
  const directoryEnd = endOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(directoryEnd + 10);
  let offset = zip.readUInt32LE(directoryEnd + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) break;
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeader = zip.readUInt32LE(offset + 42);
    const entryName = zip.toString(
      "utf8",
      offset + CENTRAL_HEADER_SIZE,
      offset + CENTRAL_HEADER_SIZE + nameLength
    );
    if (entryName === name) {
      const localNameLength = zip.readUInt16LE(localHeader + 26);
      const localExtraLength = zip.readUInt16LE(localHeader + 28);
      const dataStart = localHeader + LOCAL_HEADER_SIZE + localNameLength + localExtraLength;
      const data = zip.subarray(dataStart, dataStart + compressedSize);
      return method === METHOD_STORED ? data : inflateRawSync(data);
    }
    offset += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }
  throw new Error(`Zip archive has no entry named ${name}.`);
}

function decodeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);
}

function paragraphText(paragraphXml: string): string {
  const pieces = paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(br|tab)\s*\/>/g);
  return [...pieces]
    .map(([, text, element]) => {
      if (element === "br") return "\n";
      if (element === "tab") return "\t";
      return decodeXml(text ?? "");
    })
    .join("");
}

export function docxParagraphs(docx: Buffer): string[] {
  const xml = readZipEntry(docx, "word/document.xml").toString("utf8");
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?\/>|<w:p[\s>][\s\S]*?<\/w:p>/g)].map(([paragraph]) =>
    paragraphText(paragraph)
  );
}
