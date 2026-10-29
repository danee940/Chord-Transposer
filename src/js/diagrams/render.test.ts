import { describe, expect, it } from "vitest";

import { renderDiagram } from "./render";
import { parseChordSymbol, type Instrument } from "./shapes";

function render(symbol: string | null, instrument: Instrument, german = false) {
  return renderDiagram(symbol === null ? null : parseChordSymbol(symbol, german), instrument);
}

describe("renderDiagram", () => {
  it("renders a placeholder for a null chord", () => {
    const node = render(null, "guitar");
    expect(node.textContent).toContain("No diagram available.");
  });

  it("renders a guitar fretboard for an open chord", () => {
    const node = render("C", "guitar");
    const svg = node.querySelector("svg.diagram-fretboard");
    expect(svg).not.toBeNull();
    expect(node.querySelector("p")!.textContent).toBe("C");
    expect(node.textContent).toContain("major");
    expect(node.querySelector("text")!.textContent).toBe("×");
  });

  it("renders open-string and muted markers", () => {
    const node = render("C", "guitar");
    const markers = [...node.querySelectorAll("text")].map((t) => t.textContent);
    expect(markers).toContain("○");
    expect(markers).toContain("×");
  });

  it("renders a barre chord with a fret-position label", () => {
    const node = render("C#", "guitar");
    const label = [...node.querySelectorAll("text")].find((t) => t.textContent.endsWith("fr"));
    expect(label).not.toBeUndefined();
  });

  it("renders a keyboard for piano with active and root keys", () => {
    const node = render("C", "piano");
    const svg = node.querySelector("svg.diagram-keyboard");
    expect(svg).not.toBeNull();
    const rects = [...svg!.querySelectorAll("rect")];
    expect(rects.some((r) => r.getAttribute("fill")!.includes("diagram-root"))).toBe(true);
    expect(rects.some((r) => r.getAttribute("fill")!.includes("diagram-active"))).toBe(true);
  });

  it("reports when no stored shape exists for a fretted instrument", () => {
    const node = render("C#", "ukulele");
    expect(node.textContent).toContain("No stored Ukulele shape.");
  });

  it("renders a guitar fretboard for a half-diminished chord", () => {
    const node = render("G#m7b5", "guitar");
    expect(node.querySelector("svg.diagram-fretboard")).not.toBeNull();
    expect(node.textContent).toContain("half-diminished");
  });

  it("lists the chord tones", () => {
    const node = render("C", "guitar");
    const notes = node.querySelector("p.font-mono");
    expect(notes!.textContent).toBe("C · E · G");
  });

  it("renders a keyboard slash chord including the bass note", () => {
    const node = render("C/G", "piano");
    expect(node.querySelector("svg.diagram-keyboard")).not.toBeNull();
  });

  it("renders an all-open fretted shape with a base fret of one", () => {
    const node = render("Am7", "ukulele");
    const label = [...node.querySelectorAll("text")].find((t) => t.textContent.endsWith("fr"));
    expect(label).toBeUndefined();
  });

  it("renders active non-root keyboard notes for a slash chord", () => {
    const node = render("C/E", "piano");
    const rects = [...node.querySelectorAll("rect")];
    expect(rects.some((r) => r.getAttribute("fill")!.includes("diagram-active"))).toBe(true);
  });

  it("highlights an active black key that is not the root", () => {
    const node = render("C7", "piano");
    const rects = [...node.querySelectorAll("rect")];
    const activeBlack = rects.filter(
      (r) => r.getAttribute("width") === "10" && r.getAttribute("fill")!.includes("diagram-active")
    );
    expect(activeBlack.length).toBeGreaterThan(0);
  });

  it("highlights a black key that is the chord root", () => {
    const node = render("Db", "piano");
    const rects = [...node.querySelectorAll("rect")];
    const rootBlack = rects.filter(
      (r) => r.getAttribute("width") === "10" && r.getAttribute("fill")!.includes("diagram-root")
    );
    expect(rootBlack.length).toBeGreaterThan(0);
  });
});
