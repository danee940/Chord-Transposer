import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  displayKey,
  initKeyPicker,
  intervalName,
  keyboardColumn,
  semitoneDistance,
  translateKey,
  type KeyPicker,
} from "./key-picker";

const KEYS = [
  "C",
  "C#",
  "Db",
  "D",
  "E",
  "F#",
  "Gb",
  "B",
  "Am",
  "F#m",
  "Bbm",
  "Bb",
  "Cis",
  "Es",
  "H",
  "Hm",
  "Fism",
];

function setupDom(): void {
  const options = KEYS.map((key) => `<option value="${key}">${key}</option>`).join("");
  document.body.innerHTML = `
    <select id="current">${options}</select>
    <button id="current_trigger" type="button"><span id="current_label"></span></button>
    <select id="target">${options}</select>
    <button id="target_trigger" type="button"><span id="target_label"></span></button>
    <div id="panel" class="hidden"><div id="title"></div></div>
    <p id="distance"></p>
    <span id="interval"></span>
    <button id="outside" type="button"></button>
  `;
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function notationButton(value: "english" | "german"): HTMLButtonElement {
  return byId("panel").querySelector<HTMLButtonElement>(`button[data-notation="${value}"]`)!;
}

function init(options: Partial<Parameters<typeof initKeyPicker>[0]> = {}): KeyPicker {
  return initKeyPicker({
    panel: byId("panel"),
    title: byId("title"),
    distance: byId("distance"),
    interval: byId("interval"),
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
    ...options,
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
    expect(semitoneDistance("C", "D", false)).toBe("+2 semitones");
    expect(semitoneDistance("C", "B", false)).toBe("−1 semitone");
    expect(semitoneDistance("C", "F#", false)).toBe("+6 semitones");
  });

  it("reports the tonic distance between relative major and minor keys", () => {
    expect(semitoneDistance("C", "Am", false)).toBe("−3 semitones");
  });

  it("labels an identical key pair", () => {
    expect(semitoneDistance("D", "D", false)).toBe("Same key");
    expect(semitoneDistance("C", "Cm", false)).toBe("+0 semitones");
  });

  it("returns null when a key cannot be parsed", () => {
    expect(semitoneDistance("", "D", false)).toBeNull();
    expect(semitoneDistance("C", "nope", false)).toBeNull();
  });

  it("reads B as B flat and H as B natural in German notation", () => {
    expect(semitoneDistance("C", "B", true)).toBe("−2 semitones");
    expect(semitoneDistance("C", "B", false)).toBe("−1 semitone");
    expect(semitoneDistance("C", "H", true)).toBe("−1 semitone");
  });
});

describe("intervalName", () => {
  it("names the shortest interval and its direction", () => {
    expect(intervalName("C", "D", false)).toBe("a whole step up");
    expect(intervalName("C", "B", false)).toBe("a half step down");
    expect(intervalName("G", "D", false)).toBe("a fourth down");
    expect(intervalName("C", "E", false)).toBe("a major third up");
    expect(intervalName("C", "Eb", false)).toBe("a minor third up");
    expect(intervalName("C", "F#", false)).toBe("a tritone up");
  });

  it("has no name for a shift of zero semitones", () => {
    expect(intervalName("D", "D", false)).toBeNull();
    expect(intervalName("C", "Cm", false)).toBeNull();
  });

  it("returns null when a key cannot be parsed", () => {
    expect(intervalName("nope", "D", false)).toBeNull();
  });
});

describe("keyboardColumn", () => {
  it("gives each white key two of the fourteen columns", () => {
    expect([0, 2, 4, 5, 7, 9, 11].map(keyboardColumn)).toEqual([1, 3, 5, 7, 9, 11, 13]);
  });

  it("centres each black key on the gap between its white neighbours", () => {
    expect([1, 3, 6, 8, 10].map(keyboardColumn)).toEqual([2, 4, 8, 10, 12]);
  });
});

describe("translateKey", () => {
  it("maps English key names to their German spelling", () => {
    expect(translateKey("B", true)).toBe("H");
    expect(translateKey("Bb", true)).toBe("B");
    expect(translateKey("C#", true)).toBe("Cis");
    expect(translateKey("Eb", true)).toBe("Es");
    expect(translateKey("Bm", true)).toBe("Hm");
    expect(translateKey("F#m", true)).toBe("Fism");
  });

  it("maps German key names back to English", () => {
    expect(translateKey("H", false)).toBe("B");
    expect(translateKey("B", false)).toBe("Bb");
    expect(translateKey("Es", false)).toBe("Eb");
    expect(translateKey("Hm", false)).toBe("Bm");
  });

  it("leaves a value it does not know alone", () => {
    expect(translateKey("nope", true)).toBe("nope");
    expect(translateKey("nope", false)).toBe("nope");
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

  it("lays the keys out as a keyboard with black keys between the white ones", () => {
    init();
    const black = keyButton("C#").parentElement!;
    const white = keyButton("D").parentElement!;
    expect(black.className).toBe("keyboard-black");
    expect(black.style.gridColumn).toBe("2 / span 2");
    expect(white.className).toBe("keyboard-white");
    expect(white.style.gridColumn).toBe("3 / span 2");
    expect(keyButton("F#m").parentElement!.className).toBe("keyboard-black");
  });

  it("shows the labels and distance on init", () => {
    init();
    expect(byId("current_label").textContent).toBe("C");
    expect(byId("distance").textContent).toBe("Same key");
    expect(byId("interval").textContent).toBe("");
  });

  it("opens for a field, marks its key, and closes on a second click", () => {
    init();
    const trigger = byId<HTMLButtonElement>("current_trigger");
    trigger.click();
    expect(byId("panel").classList.contains("hidden")).toBe(false);
    expect(byId("title").textContent).toBe("Current key");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(keyButton("C").getAttribute("aria-pressed")).toBe("true");
    expect(keyButton("D").getAttribute("aria-pressed")).toBe("false");

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
    expect(byId("interval").textContent).toBe("a tritone up");
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

  it("relabels the grid in German notation and converts the chosen keys", () => {
    const picker = init();
    byId<HTMLSelectElement>("current").value = "Bb";
    byId<HTMLSelectElement>("target").value = "B";
    picker.setNotation(true);

    expect(byId<HTMLSelectElement>("current").value).toBe("B");
    expect(byId<HTMLSelectElement>("target").value).toBe("H");
    expect(byId("current_label").textContent).toBe("B");
    expect(byId("target_label").textContent).toBe("H");
    expect(keyButton("H")).not.toBeNull();
    expect(keyButton("Es")).not.toBeNull();
    expect(byId("panel").querySelector('button[data-key="Bb"]')).toBeNull();
    expect(byId("panel").querySelector('button[data-key="Gesm"]')).toBeNull();
  });

  it("converts the chosen keys back when notation returns to English", () => {
    const picker = init();
    byId<HTMLSelectElement>("current").value = "B";
    picker.setNotation(true);
    expect(byId<HTMLSelectElement>("current").value).toBe("H");
    picker.setNotation(false);
    expect(byId<HTMLSelectElement>("current").value).toBe("B");
    expect(keyButton("Bb")).not.toBeNull();
  });

  it("keeps the current value when the select has no option for the translation", () => {
    const picker = init();
    byId<HTMLSelectElement>("current").value = "Db";
    picker.setNotation(true);
    expect(byId<HTMLSelectElement>("current").value).toBe("Db");
  });

  it("does nothing when the notation is already the active one", () => {
    const picker = init();
    byId<HTMLSelectElement>("current").value = "B";
    picker.setNotation(false);
    expect(byId<HTMLSelectElement>("current").value).toBe("B");
  });

  it("picks a German key from the relabelled grid", () => {
    const picker = init();
    picker.setNotation(true);
    byId("target_trigger").click();
    keyButton("Es").click();
    expect(byId<HTMLSelectElement>("target").value).toBe("Es");
    expect(byId("target_label").textContent).toBe("Es");
  });

  it("offers a notation switch inside the panel, marking the active one", () => {
    init();
    expect(notationButton("english").getAttribute("aria-pressed")).toBe("true");
    expect(notationButton("german").getAttribute("aria-pressed")).toBe("false");
    expect(notationButton("english").textContent).toBe("A–B");
    expect(notationButton("german").textContent).toBe("A–H");
  });

  it("switches the grid when the reader picks a notation and reports the pick", () => {
    const picked: boolean[] = [];
    init({ onNotationPick: (german) => picked.push(german) });
    byId<HTMLSelectElement>("current").value = "Bb";
    notationButton("german").click();
    expect(picked).toEqual([true]);
    expect(byId<HTMLSelectElement>("current").value).toBe("B");
    expect(keyButton("H")).not.toBeNull();
    expect(notationButton("german").getAttribute("aria-pressed")).toBe("true");
  });

  it("ignores detection once the reader has picked a notation", () => {
    const picker = init();
    notationButton("english").click();
    picker.setNotation(true);
    expect(keyButton("Bb")).not.toBeNull();
    expect(byId("panel").querySelector('button[data-key="H"]')).toBeNull();
  });

  it("reports the override only once the reader has picked one", () => {
    const picker = init();
    expect(picker.notationOverride()).toBeUndefined();
    picker.setNotation(true);
    expect(picker.notationOverride()).toBeUndefined();
    expect(keyButton("H")).not.toBeNull();
    notationButton("english").click();
    expect(picker.notationOverride()).toBe(false);
  });

  it("starts from a saved notation and treats it as an override", () => {
    const picker = init({ savedNotation: true });
    expect(picker.notationOverride()).toBe(true);
    expect(keyButton("H")).not.toBeNull();
    picker.setNotation(false);
    expect(keyButton("H")).not.toBeNull();
  });

  it("does nothing when the picked notation is already active", () => {
    const picked: boolean[] = [];
    init({ onNotationPick: (german) => picked.push(german) });
    notationButton("english").click();
    expect(picked).toEqual([false]);
    expect(keyButton("Bb")).not.toBeNull();
  });

  it("hides the distance when a select holds an unknown value", () => {
    const picker = init();
    byId<HTMLSelectElement>("current").value = "";
    picker.refresh();
    expect(byId("distance").textContent).toBe("");
    expect(byId("distance").classList.contains("hidden")).toBe(true);
    expect(byId("interval").textContent).toBe("");
  });
});
