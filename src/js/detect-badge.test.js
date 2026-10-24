import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDetectionBadge } from "./detect-badge.js";

function buildDom() {
  document.body.innerHTML = `
    <span id="wrap" class="hidden">
      <span id="label"></span>
      <button id="alt" class="hidden"></button>
    </span>
    <select id="key">
      <option value="C">C</option>
      <option value="G">G</option>
      <option value="Am">Am</option>
    </select>
  `;
  return {
    wrap: document.getElementById("wrap"),
    label: document.getElementById("label"),
    altButton: document.getElementById("alt"),
    select: document.getElementById("key"),
  };
}

describe("createDetectionBadge", () => {
  let elements;

  beforeEach(() => {
    elements = buildDom();
  });

  it("preselects the detected key and shows the badge", () => {
    const badge = createDetectionBadge(elements);
    badge.detect("G C D7 G\nEm C D7 G");
    expect(elements.select.value).toBe("G");
    expect(elements.label.textContent).toBe("Detected: G");
    expect(elements.wrap.classList.contains("hidden")).toBe(false);
    expect(elements.altButton.classList.contains("hidden")).toBe(true);
  });

  it("offers the alternate key when detection is ambiguous", () => {
    const badge = createDetectionBadge(elements);
    badge.detect("Am F C G\nAm F C G\nAm");
    expect(elements.select.value).toBe("Am");
    expect(elements.altButton.classList.contains("hidden")).toBe(false);
    expect(elements.altButton.textContent).toBe("or C?");
  });

  it("switches to the alternate on click and locks the pick", () => {
    const onAltPick = vi.fn();
    const badge = createDetectionBadge({ ...elements, onAltPick });
    badge.detect("Am F C G\nAm F C G\nAm");
    elements.altButton.dispatchEvent(new Event("click"));
    expect(elements.select.value).toBe("C");
    expect(elements.label.textContent).toBe("Detected: C");
    expect(elements.altButton.textContent).toBe("or Am?");
    expect(onAltPick).toHaveBeenCalledOnce();
    badge.detect("G C D7 G");
    expect(elements.select.value).toBe("C");
  });

  it("ignores alt clicks without an alternate", () => {
    const onAltPick = vi.fn();
    createDetectionBadge({ ...elements, onAltPick });
    elements.altButton.dispatchEvent(new Event("click"));
    expect(onAltPick).not.toHaveBeenCalled();
  });

  it("works without an onAltPick callback", () => {
    createDetectionBadge(elements);
    const badge = createDetectionBadge(elements);
    badge.detect("D C G D");
    elements.altButton.dispatchEvent(new Event("click"));
    expect(elements.label.textContent).toBe("Detected: G");
  });

  it("does not move the select after a user pick", () => {
    const badge = createDetectionBadge(elements);
    badge.markUserPick();
    elements.select.value = "Am";
    badge.detect("G C D7 G\nEm C D7 G");
    expect(elements.select.value).toBe("Am");
    expect(elements.label.textContent).toBe("Detected: G");
  });

  it("shows the badge without preselecting when the key has no option", () => {
    const badge = createDetectionBadge(elements);
    elements.select.value = "C";
    badge.detect("H E Fis7 H\nE H Fis7 H");
    expect(elements.select.value).toBe("C");
    expect(elements.label.textContent).toBe("Detected: H");
  });

  it("keeps the select when the clicked alternate has no option", () => {
    const badge = createDetectionBadge(elements);
    badge.apply({ key: "C", alternate: "H", ambiguous: true });
    elements.altButton.dispatchEvent(new Event("click"));
    expect(elements.select.value).toBe("C");
    expect(elements.label.textContent).toBe("Detected: H");
  });

  it("hides the badge when nothing is detected", () => {
    const badge = createDetectionBadge(elements);
    badge.detect("G C D7 G");
    badge.detect("just lyrics");
    expect(elements.wrap.classList.contains("hidden")).toBe(true);
    expect(elements.label.textContent).toBe("");
  });

  it("applies a server-side detection result", () => {
    const badge = createDetectionBadge(elements);
    badge.apply({ key: "G", alternate: null, ambiguous: false, chords: 4, distinct: 3 });
    expect(elements.select.value).toBe("G");
    badge.apply(null);
    expect(elements.wrap.classList.contains("hidden")).toBe(true);
  });

  it("re-enables preselection after reset", () => {
    const badge = createDetectionBadge(elements);
    badge.markUserPick();
    badge.detect("G C D7 G\nEm C D7 G");
    expect(elements.select.value).toBe("C");
    badge.reset();
    expect(elements.wrap.classList.contains("hidden")).toBe(true);
    badge.detect("G C D7 G\nEm C D7 G");
    expect(elements.select.value).toBe("G");
  });
});
