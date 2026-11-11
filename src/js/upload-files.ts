export type TextFormat = "pdf" | "txt" | "chordpro";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = [".txt", ".pro", ".cho"];

export const TEXT_FORMAT_EXTENSIONS: Readonly<Record<TextFormat, string>> = {
  pdf: "pdf",
  txt: "txt",
  chordpro: "pro",
};

export function isTextName(name: string): boolean {
  return TEXT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

export function isDocxName(name: string): boolean {
  return name.toLowerCase().endsWith(".docx");
}

export function validateFile(file: File): string | null {
  if (!isDocxName(file.name) && !isTextName(file.name))
    return "Unsupported file type. Upload .docx, .txt, .pro, or .cho.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "File is too large. The maximum size is 10 MB.";
  return null;
}

export function nativeTextFormat(name: string): TextFormat {
  return name.toLowerCase().endsWith(".txt") ? "txt" : "chordpro";
}

export function originalFormatLabel(name: string): string {
  return isTextName(name) ? `.${TEXT_FORMAT_EXTENSIONS[nativeTextFormat(name)]}` : ".docx";
}
