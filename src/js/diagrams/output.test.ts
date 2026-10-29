import { describe, expect, it } from "vitest";

import { buildInteractiveOutput } from "./output";

function stripToPlainText(text: string) {
  const container = document.createElement("div");
  container.appendChild(buildInteractiveOutput(text));
  return container.textContent;
}

function chordButtons(text: string) {
  const container = document.createElement("div");
  container.appendChild(buildInteractiveOutput(text));
  return [...container.querySelectorAll<HTMLButtonElement>("button.chord-token")];
}

describe("buildInteractiveOutput round-trip", () => {
  const samples = [
    "C           G           Am          F\nTwinkle twinkle little star",
    "F      C      G      C\nUp above the world so high\n",
    "Cis  H   Ais7  Es\nEin kleines Lied",
    "[C]Twinkle [G]twinkle [Am]little [F]star",
    "Just a plain lyric line with no chords at all",
    "Am7      D/F#     Gmaj7\n",
    "",
  ];

  for (const sample of samples) {
    it(`preserves original text when markup is stripped: ${JSON.stringify(sample.slice(0, 24))}`, () => {
      expect(stripToPlainText(sample)).toBe(sample);
    });
  }

  it("wraps recognised chord tokens on a chord line", () => {
    const buttons = chordButtons("C           G           Am          F");
    expect(buttons.map((button) => button.dataset.chord)).toEqual(["C", "G", "Am", "F"]);
  });

  it("leaves pure lyric lines untouched", () => {
    expect(chordButtons("Up above the world so high")).toHaveLength(0);
  });

  it("wraps bracketed ChordPro chords while keeping brackets as text", () => {
    const buttons = chordButtons("[C]Twinkle [G]twinkle");
    expect(buttons.map((button) => button.dataset.chord)).toEqual(["C", "G"]);
  });

  it("marks German chord lines for German-aware parsing", () => {
    const buttons = chordButtons("Cis  H   Ais7");
    expect(buttons.every((button) => button.dataset.german === "1")).toBe(true);
  });

  it("keeps affix punctuation in the label but strips it for lookup", () => {
    const buttons = chordButtons("(C)  Am,");
    expect(buttons.map((button) => button.textContent)).toEqual(["(C)", "Am,"]);
    expect(buttons.map((button) => button.dataset.chord)).toEqual(["C", "Am"]);
  });

  it("keeps non-chord tokens on a chord line as plain text", () => {
    const text = "C  Verse:  G";
    expect(stripToPlainText(text)).toBe(text);
    expect(chordButtons(text).map((button) => button.dataset.chord)).toEqual(["C", "G"]);
  });

  it("leaves non-chord bracketed spans untouched", () => {
    const text = "[Chorus] the words [zzz] more";
    expect(stripToPlainText(text)).toBe(text);
    expect(chordButtons(text)).toHaveLength(0);
  });

  it("invokes the activation callback when a chord button is clicked", () => {
    const container = document.createElement("div");
    let activated: string | null | undefined = null;
    container.appendChild(
      buildInteractiveOutput("C G", (button) => {
        activated = button.dataset.chord;
      })
    );
    container.querySelector("button.chord-token")!.dispatchEvent(new Event("click"));
    expect(activated).toBe("C");
  });
});
