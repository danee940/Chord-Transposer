import {
  TEXT_FORMAT_EXTENSIONS,
  isTextName,
  nativeTextFormat,
  type TextFormat,
} from "./upload-files";
import type { PreviewEdit } from "./upload-preview";

export interface UploadRequest {
  endpoint: string;
  body: FormData;
  multi: boolean;
  fallback: string;
}

export interface RequestContext {
  form: HTMLFormElement;
  from: string;
  to: string;
  notation: boolean | undefined;
  format: string;
}

function keyFormData({ from, to }: RequestContext): FormData {
  const data = new FormData();
  data.append("current_key", from);
  data.append("target_key", to);
  return data;
}

function appendNotation(data: FormData, { notation }: RequestContext): FormData {
  if (notation !== undefined) data.append("notation", notation ? "german" : "english");
  return data;
}

function appendOverrides(data: FormData, edits: PreviewEdit[], context: RequestContext): FormData {
  appendNotation(data, context);
  if (edits.length > 0) data.append("edits", JSON.stringify(edits));
  return data;
}

function textOutputFormat(name: string, format: string): TextFormat {
  return format === "pdf" ? "pdf" : nativeTextFormat(name);
}

export function buildBinderRequest(files: File[], context: RequestContext): UploadRequest {
  const data = keyFormData(context);
  files.forEach((file) => data.append("files", file));
  return {
    endpoint: "/binder",
    body: appendNotation(data, context),
    multi: true,
    fallback: "chord_binder.pdf",
  };
}

export function buildSingleRequest(
  file: File,
  edits: PreviewEdit[],
  context: RequestContext
): UploadRequest {
  if (isTextName(file.name)) {
    const format = textOutputFormat(file.name, context.format);
    const data = keyFormData(context);
    data.append("file", file);
    data.append("format", format);
    return {
      endpoint: "/transpose-text",
      body: appendOverrides(data, edits, context),
      multi: false,
      fallback: `transposed.${TEXT_FORMAT_EXTENSIONS[format]}`,
    };
  }
  return {
    endpoint: "/transpose",
    body: appendOverrides(new FormData(context.form), edits, context),
    multi: false,
    fallback: `transposed.${context.format}`,
  };
}
