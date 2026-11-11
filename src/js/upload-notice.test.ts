import { beforeEach, describe, expect, it } from "vitest";

import { requireElement } from "./dom";
import { createNotice, type Notice } from "./upload-notice";

let notice: Notice;
let message: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="message" class="hidden"></div>';
  message = requireElement("message");
  notice = createNotice(message);
});

describe("createNotice", () => {
  it("hides the message area and clears its contents", () => {
    notice.error("boom");
    notice.hide();
    expect(message.className).toBe("hidden");
    expect(message.textContent).toBe("");
  });

  it("renders an error with the error styling", () => {
    notice.error("boom");
    expect(message.className).toContain("notice-error");
    expect(message.textContent).toBe("boom");
  });

  it("renders a heading-only result without the detail margin", () => {
    notice.result("Binder created");
    expect(message.className).toContain("notice-ok");
    expect(message.firstElementChild?.className).toBe("font-semibold");
    expect(message.textContent).toBe("Binder created");
  });

  it("adds a bottom margin to the heading when details follow", () => {
    const detail = document.createElement("p");
    detail.textContent = "detail";
    notice.result("Done", detail);
    expect(message.firstElementChild?.className).toBe("mb-2 font-semibold");
    expect(message.textContent).toBe("Donedetail");
  });
});

describe("transposeResult", () => {
  it("renders one table row per chord change", () => {
    notice.transposeResult("C", "D", "C->D, G->A");

    const headers = [...message.querySelectorAll("th")].map((cell) => cell.textContent);
    expect(headers).toEqual(["Before", "After"]);

    const rows = [...message.querySelectorAll("tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent)
    );
    expect(rows).toEqual([
      ["C", "D"],
      ["G", "A"],
    ]);
    expect(message.textContent).toContain("Transposed from C to D");
  });

  it("renders an empty body when nothing changed", () => {
    notice.transposeResult("C", "C", "");
    expect(message.querySelectorAll("tbody tr")).toHaveLength(0);
  });
});
