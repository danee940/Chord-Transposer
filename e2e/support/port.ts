import { createHash } from "node:crypto";

const FIRST_PORT = 20000;
const PORT_PAIRS = 5000;

export function portForDirectory(directory: string): number {
  const digest = createHash("sha1").update(directory).digest();
  return FIRST_PORT + (digest.readUInt32BE(0) % PORT_PAIRS) * 2;
}

export function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65534) {
    throw new Error(`E2E_PORT must be an integer between 1 and 65534, got "${raw}".`);
  }
  return port;
}
