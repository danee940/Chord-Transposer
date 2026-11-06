import { readFile } from "node:fs/promises";
import type { Download } from "@playwright/test";

export async function downloadedBytes(download: Download): Promise<Buffer> {
  return readFile(await download.path());
}

export async function downloadedText(download: Download): Promise<string> {
  return (await downloadedBytes(download)).toString("utf8");
}
