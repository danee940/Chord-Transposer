import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireElement } from "./dom";
import { createDropzone, type Dropzone } from "./upload-dropzone";

let dropzone: Dropzone;
let fileInput: HTMLInputElement;
let zone: HTMLElement;
let zoneText: HTMLElement;

function textFile(name: string, body: string): File {
  return new File([body], name, { type: "text/plain" });
}

function setFiles(files: File[]): void {
  fileInput.files = files as unknown as FileList;
}

function stubDataTransfer(): void {
  globalThis.DataTransfer = class {
    readonly items: { add: (file: File) => void };
    private readonly storedFiles: File[] = [];
    constructor() {
      this.items = { add: (file: File) => this.storedFiles.push(file) };
    }
    get files(): File[] {
      return this.storedFiles;
    }
  } as unknown as typeof DataTransfer;
}

beforeEach(() => {
  document.body.innerHTML = `
    <input id="file" type="file" multiple />
    <div id="dropzone"><span id="dropzone-text"></span></div>`;
  stubDataTransfer();
  fileInput = requireElement<HTMLInputElement>("file");
  let held: File[] = [];
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    get: () => held,
    set: (value: File[]) => {
      held = value;
    },
  });
  zone = requireElement("dropzone");
  zoneText = requireElement("dropzone-text");
  dropzone = createDropzone({ fileInput, dropzone: zone, dropzoneText: zoneText });
});

describe("selection", () => {
  it("reads the current selection", () => {
    setFiles([textFile("a.txt", "x")]);
    expect(dropzone.selectedFiles().map((file) => file.name)).toEqual(["a.txt"]);
  });

  it("replaces the selection and fires a change event", () => {
    const onChange = vi.fn();
    fileInput.addEventListener("change", onChange);
    dropzone.replaceFiles([textFile("b.txt", "y")]);
    expect(dropzone.selectedFiles().map((file) => file.name)).toEqual(["b.txt"]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("clears the input and focuses it on request", () => {
    setFiles([textFile("a.txt", "x")]);
    dropzone.clear();
    expect(fileInput.value).toBe("");
    dropzone.focusInput();
    expect(document.activeElement).toBe(fileInput);
  });
});

describe("prompt text", () => {
  it("shows the idle prompt for an empty selection", () => {
    dropzone.update([]);
    expect(zoneText.textContent).toBe("Drop your chord sheets here or click to browse");
  });

  it("shows the file name and size for one file", () => {
    dropzone.update([textFile("song.txt", "hello")]);
    expect(zoneText.textContent).toContain("song.txt");
    expect(zoneText.textContent).toContain("1 KB");
  });

  it("shows a count and combined size for several files", () => {
    dropzone.update([textFile("a.txt", "12"), textFile("b.txt", "345")]);
    expect(zoneText.textContent).toContain("2 files selected");
    expect(zoneText.textContent).toContain("1 KB");
  });
});

describe("drag and drop", () => {
  it("marks and unmarks the drag state", () => {
    zone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(zone.dataset["dragging"]).toBe("");
    zone.dispatchEvent(new Event("dragleave", { bubbles: true, cancelable: true }));
    expect(zone.dataset["dragging"]).toBeUndefined();
  });

  it("adopts dropped files", () => {
    const transfer = new DataTransfer();
    transfer.items.add(textFile("dropped.txt", "z"));
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: transfer });
    zone.dispatchEvent(event);
    expect(dropzone.selectedFiles().map((file) => file.name)).toEqual(["dropped.txt"]);
  });

  it("ignores a drop with no files", () => {
    setFiles([textFile("kept.txt", "k")]);
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: new DataTransfer() });
    zone.dispatchEvent(event);
    expect(dropzone.selectedFiles().map((file) => file.name)).toEqual(["kept.txt"]);
  });
});
