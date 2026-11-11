export const GENERIC_ERROR = "Something went wrong.";

export interface ErrorDetails {
  message: string;
  index: number | null;
}

export function errorDetails(payload: unknown): ErrorDetails {
  const record: Record<string, unknown> =
    typeof payload === "object" && payload !== null ? { ...payload } : {};
  const { error, index } = record;
  return {
    message: typeof error === "string" && error !== "" ? error : GENERIC_ERROR,
    index: Number.isInteger(index) ? Number(index) : null,
  };
}

export function parseDownloadFilename(disposition: string, fallback: string): string {
  const extended = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (extended !== undefined) {
    try {
      return decodeURIComponent(extended);
    } catch {
      return fallback;
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(disposition)?.[1];
  if (quoted !== undefined) return quoted;
  const bare = /filename=([^;]+)/i.exec(disposition)?.[1];
  if (bare !== undefined) return bare.trim();
  return fallback;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function changePairs(changesRaw: string): [string, string][] {
  return changesRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("->");
      return separator === -1
        ? [entry, ""]
        : [entry.slice(0, separator), entry.slice(separator + 2)];
    });
}
