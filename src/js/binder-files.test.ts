import { describe, expect, it, vi } from "vitest";

import {
  checkBinder,
  fileKey,
  flaggedSummary,
  focusFileAction,
  formatBytes,
  MAX_BINDER_FILES,
  moveItem,
  renderFileList,
} from "./binder-files";

function makeFile(name: string, size: number): File {
  const file = new File([""], name, { lastModified: 0 });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("formatBytes", () => {
  it("shows kilobytes below a megabyte, never less than one", () => {
    expect(formatBytes(10)).toBe("1 KB");
    expect(formatBytes(14_000)).toBe("14 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("checkBinder", () => {
  it("accepts a set of .docx files", () => {
    const result = checkBinder([makeFile("a.docx", 10), makeFile("B.DOCX", 10)]);
    expect(result.summary).toBeNull();
    expect(result.entries.map((entry) => entry.problem)).toEqual([null, null]);
  });

  it("flags each file that cannot go in a binder", () => {
    const result = checkBinder([makeFile("a.txt", 10), makeFile("b.docx", 0)]);
    expect(result.entries.map((entry) => entry.problem)).toEqual([
      "Only .docx files can go in a binder.",
      "This file is empty.",
    ]);
    expect(result.summary).toBe("Remove the 2 highlighted files to build the binder.");
  });

  it("adds problems reported elsewhere, after the file's own problem", () => {
    const known = (file: File) => (file.name === "b.docx" ? "Could not be read." : null);
    const result = checkBinder([makeFile("a.docx", 10), makeFile("b.docx", 10)], known);
    expect(result.entries.map((entry) => entry.problem)).toEqual([null, "Could not be read."]);
    expect(result.summary).toBe("Remove the highlighted file to build the binder.");
    expect(checkBinder([makeFile("b.docx", 0)], known).entries[0]!.problem).toBe(
      "This file is empty."
    );
  });

  it("reports too many files before anything else", () => {
    const files = Array.from({ length: MAX_BINDER_FILES + 1 }, (_, i) => makeFile(`${i}.txt`, 1));
    expect(checkBinder(files).summary).toBe("Too many files. The maximum is 20.");
  });

  it("reports a combined size over the limit", () => {
    const files = [makeFile("a.docx", 30 * 1024 * 1024), makeFile("b.docx", 20 * 1024 * 1024)];
    expect(checkBinder(files).summary).toBe("Files are too large. The combined maximum is 40 MB.");
  });
});

describe("fileKey", () => {
  it("tells apart files that share a name", () => {
    expect(fileKey(makeFile("song.docx", 10))).not.toBe(fileKey(makeFile("song.docx", 20)));
    expect(fileKey(makeFile("song.docx", 10))).toBe(fileKey(makeFile("song.docx", 10)));
  });
});

describe("flaggedSummary", () => {
  it("uses the singular for one file", () => {
    expect(flaggedSummary(1)).toBe("Remove the highlighted file to build the binder.");
    expect(flaggedSummary(3)).toBe("Remove the 3 highlighted files to build the binder.");
  });
});

describe("moveItem", () => {
  it("swaps an item with its neighbour", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("leaves the order alone past either end", () => {
    const items = ["a", "b"];
    expect(moveItem(items, 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(items, 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(items, 1, 1)).not.toBe(items);
  });
});

describe("renderFileList", () => {
  function render(names: string[]) {
    const list = document.createElement("ol");
    document.body.replaceChildren(list);
    const actions = { move: vi.fn(), remove: vi.fn() };
    renderFileList(
      list,
      names.map((name) => ({ file: makeFile(name, 2048), problem: null })),
      actions
    );
    return { list, actions };
  }

  it("numbers the songs and wires their actions", () => {
    const { list, actions } = render(["a.docx", "b.docx"]);
    expect(list.classList.contains("hidden")).toBe(false);
    const buttons = [...list.querySelectorAll("button")];
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Move a.docx up",
      "Move a.docx down",
      "Remove a.docx",
      "Move b.docx up",
      "Move b.docx down",
      "Remove b.docx",
    ]);
    expect(buttons.map((button) => button.disabled)).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
    ]);
    buttons[1]!.click();
    buttons[3]!.click();
    buttons[5]!.click();
    expect(actions.move.mock.calls).toEqual([
      [0, 1],
      [1, -1],
    ]);
    expect(actions.remove).toHaveBeenCalledWith(1);
  });

  it("hides the list for fewer than two songs", () => {
    expect(render(["a.docx"]).list.classList.contains("hidden")).toBe(true);
  });

  it("focuses the requested action, or the opposite move once a song reaches an end", () => {
    const { list } = render(["a.docx", "b.docx", "c.docx"]);
    focusFileAction(list, 1, "up");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Move b.docx up");
    focusFileAction(list, 0, "up");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Move a.docx down");
    focusFileAction(list, 2, "down");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Move c.docx up");
    focusFileAction(list, 9, "remove");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove c.docx");
  });

  it("falls back to the remove button when a lone song cannot move", () => {
    const { list } = render(["a.docx"]);
    focusFileAction(list, 0, "up");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove a.docx");
  });

  it("does nothing on an empty list", () => {
    const list = document.createElement("ol");
    expect(() => focusFileAction(list, 0, "remove")).not.toThrow();
  });
});
