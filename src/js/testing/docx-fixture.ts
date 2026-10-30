const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

export interface ZipFixtureEntry {
  name: string;
  data: Uint8Array;
  method: number;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function header(size: number, fill: (view: DataView) => void): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  fill(new DataView(bytes.buffer));
  return bytes;
}

export function buildZip(entries: ZipFixtureEntry[], comment = ""): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const local = concat([
      header(30, (view) => {
        view.setUint32(0, LOCAL_HEADER_SIGNATURE, true);
        view.setUint16(8, entry.method, true);
        view.setUint32(18, entry.data.length, true);
        view.setUint32(22, entry.data.length, true);
        view.setUint16(26, name.length, true);
      }),
      name,
      entry.data,
    ]);
    centrals.push(
      concat([
        header(46, (view) => {
          view.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
          view.setUint16(10, entry.method, true);
          view.setUint32(20, entry.data.length, true);
          view.setUint32(24, entry.data.length, true);
          view.setUint16(28, name.length, true);
          view.setUint32(42, offset, true);
        }),
        name,
      ])
    );
    locals.push(local);
    offset += local.length;
  }
  const directory = concat(centrals);
  const commentBytes = encoder.encode(comment);
  const end = header(22, (view) => {
    view.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, directory.length, true);
    view.setUint32(16, offset, true);
    view.setUint16(20, commentBytes.length, true);
  });
  return concat([...locals, directory, end, commentBytes]);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function documentXml(paragraphs: string[]): string {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${WORD_NAMESPACE}"><w:body>${body}</w:body></w:document>`;
}

export function buildDocx(paragraphs: string[]): Uint8Array<ArrayBuffer> {
  return buildZip([
    { name: "[Content_Types].xml", data: new TextEncoder().encode("<Types/>"), method: 0 },
    {
      name: "word/document.xml",
      data: new TextEncoder().encode(documentXml(paragraphs)),
      method: 0,
    },
  ]);
}

export function docxFile(name: string, paragraphs: string[]): File {
  const bytes = buildDocx(paragraphs);
  const file = new File([bytes], name);
  Object.defineProperty(file, "size", { value: bytes.length });
  file.arrayBuffer = () => Promise.resolve(bytes.buffer.slice(0));
  return file;
}
