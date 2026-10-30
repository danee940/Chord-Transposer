import { beforeEach, describe, expect, it, vi } from "vitest";

import { displayKey, initKeyPicker, semitoneDistance, type KeyPicker } from "./key-picker";

const KEYS = ["C", "C#", "Db", "D", "E", "F#", "Gb", "B", "Am", "F#m", "Bbm"];

function setupDom(): void {
  const options = KEYS.map((key) => `<option value="${key}">${key}</option>`).join("");
  document.body.innerHTML = `
    <select id="current">${options}</select>
    <button id="current_trigger" type="button"><span id="current_label"></span></button>
    <select id="target">${options}</select>
    <button id="target_trigger" type="button"><span id="target_label"></span></button>
    <div id="panel" class="hidden"><div id="title"></div></div>
    <p id="distance"></p>
    <button id="outside" type="button"></button>
  `;
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function init(): KeyPicker {
  return initKeyPicker({
    panel: byId("panel"),
    title: byId("title"),
    distance: byId("distance"),
    fields: [
      {
        trigger: byId<HTMLButtonElement>("current_trigger"),
        label: byId("current_label"),
        select: byId<HTMLSelectElement>("current"),
        title: "Current key",
      },
      {
        trigger: byId<HTMLButtonElement>("target_trigger"),
        label: byId("target_label"),
        select: byId<HTMLSelectElement>("target"),
        title: "Desired key",
      },
    ],
  });
}

function keyButton(value: string): HTMLButtonElement {
  return byId("panel").querySelector<HTMLButtonElement>(`button[data-key="${value}"]`)!;
}

describe("displayKey", () => {
  it("renders accidentals as musical glyphs", () => {
    expect(displayKey("C")).toBe("C");
    expect(displayKey("C#m")).toBe("C♯m");
    expect(displayKey("Bb")).toBe("B♭");
  });
});

describe("semitoneDistance", () => {
  it("shows the shortest direction with a sign", () => {
    expect(semitoneDistance("C", "D")).toBe("+2 semitones");
    expect(semitoneDistance("C", "B")).toBe("−1 semitone");
    expect(semitoneDistance("C", "F#")).toBe("+6 semitones");
  });

  it("reports the tonic distance between relative major and minor keys", () => {
    expect(semitoneDistance("C", "Am")).toBe("−3 semitones");
  });

  it("labels an identical key pair", () => {
    expect(semitoneDistance("D", "D")).toBe("Same key");
    expect(semitoneDistance("C", "Cm")).toBe("+0 semitones");
  });

  it("returns null when a key cannot be parsed", () => {
    expect(semitoneDistance("", "D")).toBeNull();
    expect(semitoneDistance("C", "nope")).toBeNull();
  });
});

describe("initKeyPicker", () => {
  beforeEach(setupDom);

  it("builds the full major and minor grid with stacked enharmonic cells", () => {
    init();
    const buttons = [...byId("panel").querySelectorAll("button[data-key]")];
    expect(buttons).toHaveLength(33);
    expect(keyButton("F#m")).not.toBeNull();
    expect(byId("panel").querySelector('button[data-key="Gbm"]')).toBeNull();
    expect(keyButton("C#").textContent).toBe("C♯");
    expect(keyButton("C#").parentElement).toBe(keyButton("Db").parentElement);
  });

  it("shows the labels and distance on init", () => {
    init();
    expect(byId("current_label").textContent).toBe("C");
    expect(byId("distance").textContent).toBe("Same key");
  });

  it("opens for a field, marks its key, and closes on a second click", () => {
    init();
    const trigger = byId<HTMLButtonElement>("current_trigger");
    trigger.click();
    expect(byId("panel").classList.contains("hidden")).toBe(false);
    expect(byId("title").textContent).toBe("Current key");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(keyButton("C").classList.contains("border-accent")).toBe(true);
    expect(keyButton("D").classList.contains("border-accent")).toBe(false);

    trigger.click();
    expect(byId("panel").classList.contains("hidden")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("switches fields while open", () => {
    init();
    byId("current_trigger").click();
    byId("target_trigger").click();
    expect(byId("panel").classList.contains("hidden")).toBe(false);
    expect(byId("title").textContent).toBe("Desired key");
    expect(byId("current_trigger").getAttribute("aria-expanded")).toBe("false");
  });

  it("picks a key, dispatches change, and updates label and distance", () => {
    init();
    const changed = vi.fn();
    byId<HTMLSelectElement>("target").addEventListener("change", changed);
    byId("target_trigger").click();
    keyButton("F#").click();
    expect(byId<HTMLSelectElement>("target").value).toBe("F#");
    expect(changed).toHaveBeenCalledOnce();
    expect(byId("target_label").textContent).toBe("F♯");
    expect(byId("distance").textContent).toBe("+6 semitones");
    expect(byId("panel").classList.contains("hidden")).toBe(true);
  });

  it("ignores key buttons while the panel is closed", () => {
    init();
    keyButton("D").click();
    expect(byId<HTMLSelectElement>("current").value).toBe("C");
    expect(byId<HTMLSelectElement>("target").value).toBe("C");
  });

  it("closes on an outside click but not on clicks within the picker", () => {
    init();
    byId("current_trigger").click();
    byId("title").dispatchEvent(new Event("click", { bubbles: true }));
    expect(byId("panel").classList.contains("hidden")).toBe(false);

    byId("outside").dispatchEvent(new Event("click", { bubbles: true }));
    expect(byId("panel").classList.contains("hidden")).toBe(true);

    byId("outside").dispatchEvent(new Event("click", { bubbles: true }));
    expect(byId("panel").classList.contains("hidden")).toBe(true);
  });

  it("closes on Escape only while open", () => {
    init();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    byId("current_trigger").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(byId("panel").classList.contains("hidden")).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(byId("panel").classList.contains("hidden")).toBe(true);
  });

  it("hides the distance when a select holds an unknown value", () => {
    const picker = init();
    byId<HTMLSelectElement>("current").value = "";
    picker.refresh();
    expect(byId("distance").textContent).toBe("");
    expect(byId("distance").classList.contains("hidden")).toBe(true);
  });
});
