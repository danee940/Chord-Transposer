import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parsePort, portForDirectory } from "./port";

export const repoRoot = resolve(import.meta.dirname, "../..");
export const generatedFixturesDir = resolve(repoRoot, "e2e/.generated");
export const staticFixturesDir = resolve(repoRoot, "e2e/fixtures");

const requestedPort = process.env["E2E_PORT"];

export const appPort =
  requestedPort === undefined ? portForDirectory(repoRoot) : parsePort(requestedPort);
export const gotenbergPort = appPort + 1;
export const appUrl = `http://127.0.0.1:${appPort}`;
export const gotenbergUrl = `http://127.0.0.1:${gotenbergPort}`;
export const pdfConversionFailureMarker = "e2e: fail pdf conversion";

function projectPython(): string {
  const venvPython = resolve(repoRoot, ".venv/bin/python");
  if (!existsSync(venvPython)) {
    throw new Error(`No Python environment at ${venvPython}. Run "uv sync" first.`);
  }
  return venvPython;
}

export const python = process.env["E2E_PYTHON"] ?? projectPython();
