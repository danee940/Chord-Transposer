import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { generatedFixturesDir, staticFixturesDir } from "./environment";

export interface UploadFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".pro": "text/plain",
  ".cho": "text/plain",
  ".pdf": "application/pdf",
};

export function uploadFile(name: string, content: Buffer | string): UploadFile {
  return {
    name,
    mimeType: MIME_TYPES[extname(name).toLowerCase()] ?? "application/octet-stream",
    buffer: typeof content === "string" ? Buffer.from(content, "utf8") : content,
  };
}

function fixture(directory: string, name: string): UploadFile {
  return uploadFile(name, readFileSync(resolve(directory, name)));
}

export const sheets = {
  amazingGraceDocx: (): UploadFile => fixture(generatedFixturesDir, "Amazing_Grace_C.docx"),
  germanDocx: (): UploadFile => fixture(generatedFixturesDir, "Stille_Nacht_H.docx"),
  secondSongDocx: (): UploadFile => fixture(generatedFixturesDir, "Little_Light_G.docx"),
  plainText: (): UploadFile => fixture(staticFixturesDir, "Twinkle_C.txt"),
  chordPro: (): UploadFile => fixture(staticFixturesDir, "Twinkle_C.cho"),
};
