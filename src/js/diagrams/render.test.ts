import { describe, expect, it } from "vitest";

import { findBarre, renderDiagram, renderFretboard } from "./render";
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

  it("lists the chord tones with the root marked", () => {
    const node = render("C", "guitar");
    const notes = node.querySelector("p.font-mono");
    expect(notes!.textContent).toBe("C · E · G");
    expect(notes!.querySelector("span")!.textContent).toBe("C");
  });

  it("marks the root notes on the fretboard, fretted and open", () => {
    const circles = [...render("C", "guitar").querySelectorAll("circle")];
    expect(circles.map((circle) => circle.getAttribute("fill"))).toEqual([
      "var(--diagram-root)",
      "currentColor",
      "var(--diagram-root)",
    ]);
    const openMarkers = [...render("A", "guitar").querySelectorAll("text")].filter(
      (text) => text.textContent === "○"
    );
    expect(openMarkers.map((marker) => marker.getAttribute("fill"))).toEqual([
      "var(--diagram-root)",
      "currentColor",
    ]);
  });

  it("names the open strings under the fretboard", () => {
    const strings = (instrument: Instrument) =>
      [...render("C", instrument).querySelectorAll("text.diagram-string")].map(
        (text) => text.textContent
      );
    expect(strings("guitar")).toEqual(["E", "A", "D", "G", "B", "E"]);
    expect(strings("ukulele")).toEqual(["G", "C", "E", "A"]);
  });

  it("draws a barre across the strings it covers", () => {
    expect(render("F", "guitar").querySelector("rect.diagram-barre")).not.toBeNull();
    expect(render("C", "guitar").querySelector("rect.diagram-barre")).toBeNull();
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

describe("renderFretboard", () => {
  it("draws strings a short shape leaves out as muted", () => {
    const chord = parseChordSymbol("E", false)!;
    const svg = renderFretboard({ kind: "fretted", instrument: "guitar", frets: [0, 2] }, chord);
    const markers = [...svg.querySelectorAll("text:not(.diagram-string)")].map(
      (text) => text.textContent
    );
    expect(markers).toEqual(["○", "×", "×", "×", "×"]);
    expect(svg.querySelectorAll("text.diagram-string")).toHaveLength(6);
  });
});

describe("findBarre", () => {
  it("spans the lowest fret when it is held on several strings without open strings", () => {
    expect(findBarre([1, 3, 3, 2, 1, 1])).toEqual({ fret: 1, from: 0, to: 5 });
    expect(findBarre([-1, 3, 5, 5, 5, 3])).toEqual({ fret: 3, from: 1, to: 5 });
    expect(findBarre([2, 3, 2, 2])).toEqual({ fret: 2, from: 0, to: 3 });
  });

  it("leaves open-string shapes unbarred", () => {
    expect(findBarre([-1, -1, 0, 2, 3, 2])).toBeNull();
  });

  it("needs the lowest fret on more than one string", () => {
    expect(findBarre([2, 3, 1, 3])).toBeNull();
  });

  it("does not bridge a muted string", () => {
    expect(findBarre([-1, 3, -1, 3, 3, 3])).toBeNull();
  });

  it("returns nothing for an all-muted shape", () => {
    expect(findBarre([-1, -1, -1, -1])).toBeNull();
  });
});
