// API contract fixture executed against the browser code.
//
// The same src/testdata/api_contract_cases.json fixture is replayed against
// the real Flask app by src/test_api_contract.py. This side drives the real
// upload frontend (initUpload) with a mocked fetch: it asserts that the
// frontend sends exactly the recorded request (endpoint and form fields) and
// renders the recorded response correctly (detection badge, change table,
// error messages, download filename). Changing either side without updating
// the fixture fails one of the two suites, so the API cannot silently drift.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import cases from "../testdata/api_contract_cases.json";
import { requireElement } from "./dom";
import { initUpload } from "./upload";

interface FileSpec {
  field: string;
  filename: string;
  content: string;
  raw: boolean;
}

interface ContractCase {
  description: string;
  endpoint: string;
  trigger: "detect" | "submit";
  request: {
    files: FileSpec[];
    form: Record<string, string>;
  };
  fields: string[];
  response: {
    status: number;
    json?: unknown;
    content_type?: string;
    headers?: Record<string, string>;
    body_text?: string;
  };
  ui: {
    detected?: string;
    detection_ignored?: boolean;
    heading?: string;
    changes?: string[][];
    download?: string;
    binder_heading?: string;
    error?: string;
  };
}

const CASES = cases as ContractCase[];

function setupDom(form: Record<string, string>): void {
  const keyOptions = ["C", form["current_key"] ?? "C", form["target_key"] ?? "D"]
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((value) => `<option value="${value}">${value}</option>`)
    .join("");
  document.body.innerHTML = `
    <form id="form">
      <input id="file" name="file" type="file" multiple />
      <div id="dropzone"><span id="dropzone-text"></span></div>
      <select id="current_key" name="current_key">${keyOptions}</select>
      <select id="target_key" name="target_key">${keyOptions}</select>
      <button id="swap" type="button"></button>
      <span id="upload_detected_wrap" class="hidden">
        <span id="upload_detected_label"></span>
        <button id="upload_detected_alt" type="button" class="hidden"></button>
      </span>
      <label><input type="radio" name="format" value="docx" checked /></label>
      <label><input type="radio" name="format" value="pdf" /></label>
      <button id="submit" type="submit"><span id="submit-label"></span><span id="spinner"></span></button>
      <div id="message"></div>
    </form>
  `;
}

function makeFile(spec: FileSpec): File {
  const file = new File([spec.content], spec.filename);
  Object.defineProperty(file, "size", { value: spec.content.length });
  file.text = () => Promise.resolve(spec.content);
  return file;
}

function setFiles(files: File[]): void {
  const input = requireElement<HTMLInputElement>("file");
  Object.defineProperty(input, "files", { value: files, configurable: true });
}

function mockResponse(spec: ContractCase["response"]) {
  return {
    ok: spec.status < 400,
    status: spec.status,
    json: async () => spec.json ?? null,
    blob: async () => new Blob([spec.body_text ?? "data"]),
    headers: { get: (name: string) => spec.headers?.[name] ?? null },
  };
}

async function trigger(contractCase: ContractCase): Promise<void> {
  setFiles(contractCase.request.files.map(makeFile));
  const fileInput = requireElement<HTMLInputElement>("file");
  fileInput.dispatchEvent(new Event("change"));
  if (contractCase.trigger === "submit") {
    const form = contractCase.request.form;
    const currentKey = form["current_key"];
    const targetKey = form["target_key"];
    if (currentKey !== undefined) {
      requireElement<HTMLSelectElement>("current_key").value = currentKey;
    }
    if (targetKey !== undefined) {
      requireElement<HTMLSelectElement>("target_key").value = targetKey;
    }
    if (form["format"] === "pdf") {
      document.querySelector<HTMLInputElement>('input[value="docx"]')!.checked = false;
      document.querySelector<HTMLInputElement>('input[value="pdf"]')!.checked = true;
    }
    requireElement<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
    await vi.waitFor(() =>
      expect(requireElement("spinner").classList.contains("hidden")).toBe(true)
    );
  } else {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  }
}

function assertRequest(contractCase: ContractCase, fetchMock: Mock): void {
  // Selecting a single .docx also fires the automatic /detect-key request, so
  // assert on the one call that targets the case's endpoint.
  const calls = fetchMock.mock.calls.filter(([url]) => url === contractCase.endpoint);
  expect(calls).toHaveLength(1);
  expect(calls[0]![1].method).toBe("POST");

  const body = calls[0]![1].body as FormData;
  expect([...body.keys()].sort()).toEqual([...contractCase.fields].sort());

  const fileFields = new Set(contractCase.request.files.map((spec) => spec.field));
  for (const [field, value] of Object.entries(contractCase.request.form)) {
    expect(body.get(field)).toBe(value);
  }
  for (const field of fileFields) {
    const expected = contractCase.request.files.filter((spec) => spec.field === field);
    const sent = body.getAll(field);
    expect(sent).toHaveLength(expected.length);
    // /transpose posts `new FormData(form)`, and jsdom does not surface Files
    // stubbed onto the input there; the TS-built requests carry real Files.
    if (contractCase.endpoint !== "/transpose") {
      expect(sent.map((entry) => (entry as File).name)).toEqual(
        expected.map((spec) => spec.filename)
      );
    }
  }
}

function assertUi(contractCase: ContractCase, downloads: string[]): void {
  const ui = contractCase.ui;
  const message = requireElement("message");
  if (ui.detected !== undefined) {
    expect(requireElement("upload_detected_label").textContent).toBe(ui.detected);
  }
  if (ui.detection_ignored === true) {
    expect(requireElement("upload_detected_wrap").classList.contains("hidden")).toBe(true);
  }
  if (ui.error !== undefined) {
    expect(message.textContent).toBe(ui.error);
  }
  if (ui.heading !== undefined) {
    expect(message.textContent).toContain(ui.heading);
  }
  if (ui.binder_heading !== undefined) {
    expect(message.textContent).toContain(ui.binder_heading);
  }
  if (ui.changes !== undefined) {
    const rows = [...message.querySelectorAll("tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent)
    );
    expect(rows).toEqual(ui.changes);
  }
  if (ui.download !== undefined) {
    expect(downloads).toEqual([ui.download]);
  }
}

describe("API contract", () => {
  let fetchMock: Mock;
  let downloads: string[];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
    globalThis.URL.revokeObjectURL = vi.fn();
    downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(CASES.map((contractCase) => [contractCase.description, contractCase] as const))(
    "%s",
    async (_description, contractCase) => {
      setupDom(contractCase.request.form);
      fetchMock.mockResolvedValue(mockResponse(contractCase.response));
      initUpload();

      await trigger(contractCase);
      await vi.waitFor(() => assertUi(contractCase, downloads));
      assertRequest(contractCase, fetchMock);
    }
  );

  it("covers every endpoint the frontend calls", () => {
    const endpoints = new Set(CASES.map((contractCase) => contractCase.endpoint));
    expect([...endpoints].sort()).toEqual([
      "/binder",
      "/detect-key",
      "/transpose",
      "/transpose-text",
    ]);
  });
});
