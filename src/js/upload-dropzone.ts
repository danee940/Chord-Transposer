import { formatBytes } from "./binder-files";

export interface DropzoneElements {
  fileInput: HTMLInputElement;
  dropzone: HTMLElement;
  dropzoneText: HTMLElement;
}

export interface Dropzone {
  selectedFiles(): File[];
  replaceFiles(files: File[]): void;
  update(files: File[]): void;
  focusInput(): void;
  clear(): void;
}

function dropzoneLine(className: string, text: string): HTMLSpanElement {
  const line = document.createElement("span");
  line.className = className;
  line.textContent = text;
  return line;
}

export function createDropzone({ fileInput, dropzone, dropzoneText }: DropzoneElements): Dropzone {
  function selectedFiles(): File[] {
    return [...fileInput.files!];
  }

  function replaceFiles(files: File[]): void {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("change"));
  }

  (["dragenter", "dragover"] as const).forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.dataset["dragging"] = "";
    })
  );
  (["dragleave", "dragend", "drop"] as const).forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      delete dropzone.dataset["dragging"];
    })
  );
  dropzone.addEventListener("drop", (event) => {
    const dropped = [...(event.dataTransfer?.files ?? [])];
    if (dropped.length === 0) return;
    replaceFiles(dropped);
  });

  return {
    selectedFiles,
    replaceFiles,
    update(files: File[]): void {
      const [first] = files;
      if (first === undefined) {
        dropzoneText.replaceChildren(
          dropzoneLine("font-medium text-ink", "Drop your chord sheets here"),
          document.createTextNode(" or click to browse")
        );
        return;
      }
      const single = files.length === 1;
      const total = files.reduce((sum, file) => sum + file.size, 0);
      dropzoneText.replaceChildren(
        dropzoneLine(
          "font-medium text-ink",
          single ? first.name : `${files.length} files selected`
        ),
        dropzoneLine("mt-0.5 block text-xs text-graphite", formatBytes(total))
      );
    },
    focusInput(): void {
      fileInput.focus();
    },
    clear(): void {
      fileInput.value = "";
    },
  };
}
