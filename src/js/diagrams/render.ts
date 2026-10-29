import { mod12 } from "../transpose/notation";
import {
  INSTRUMENT_LABELS,
  QUALITY_INTERVALS,
  QUALITY_LABELS,
  chordNotes,
  lookupShape,
  type FrettedShape,
  type Instrument,
  type ParsedChord,
} from "./shapes";

const SVG_NS = "http://www.w3.org/2000/svg";

const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER_WHITE: Readonly<Partial<Record<number, number>>> = {
  0: 1,
  2: 3,
  5: 6,
  7: 8,
  9: 10,
};

function svgEl(name: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function chordPitchClasses(chord: ParsedChord): Set<number> {
  const classes = new Set(
    QUALITY_INTERVALS[chord.family].map((interval) => mod12(chord.rootSemitone + interval))
  );
  if (chord.bassSemitone !== null) classes.add(mod12(chord.bassSemitone));
  return classes;
}

function fretWindow(frets: number[]): { baseFret: number; fretCount: number } {
  const played = frets.filter((fret) => fret > 0);
  const fretCount = 5;
  if (played.length === 0) return { baseFret: 1, fretCount };
  const maxFret = Math.max(...played);
  const minFret = Math.min(...played);
  if (maxFret <= fretCount) return { baseFret: 1, fretCount };
  return { baseFret: minFret, fretCount: Math.max(fretCount, maxFret - minFret + 1) };
}

function renderFretboard(shape: FrettedShape): SVGElement {
  const { frets } = shape;
  const stringCount = frets.length;
  const { baseFret, fretCount } = fretWindow(frets);

  const cellWidth = 16;
  const cellHeight = 22;
  const marginLeft = 22;
  const marginTop = 26;
  const gridWidth = (stringCount - 1) * cellWidth;
  const gridHeight = fretCount * cellHeight;
  const width = marginLeft + gridWidth + 12;
  const height = marginTop + gridHeight + 8;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    class: "diagram-fretboard",
  });

  const nutThick = baseFret === 1;
  for (let row = 0; row <= fretCount; row += 1) {
    const y = marginTop + row * cellHeight;
    svg.appendChild(
      svgEl("line", {
        x1: marginLeft,
        y1: y,
        x2: marginLeft + gridWidth,
        y2: y,
        stroke: "currentColor",
        "stroke-width": row === 0 && nutThick ? 3 : 1,
      })
    );
  }
  for (let stringIndex = 0; stringIndex < stringCount; stringIndex += 1) {
    const x = marginLeft + stringIndex * cellWidth;
    svg.appendChild(
      svgEl("line", {
        x1: x,
        y1: marginTop,
        x2: x,
        y2: marginTop + gridHeight,
        stroke: "currentColor",
        "stroke-width": 1,
      })
    );
  }

  if (baseFret > 1) {
    const label = svgEl("text", {
      x: marginLeft - 6,
      y: marginTop + cellHeight * 0.7,
      "text-anchor": "end",
      "font-size": 10,
      fill: "currentColor",
    });
    label.textContent = `${baseFret}fr`;
    svg.appendChild(label);
  }

  frets.forEach((fret, stringIndex) => {
    const x = marginLeft + stringIndex * cellWidth;
    if (fret <= 0) {
      const marker = svgEl("text", {
        x,
        y: marginTop - 8,
        "text-anchor": "middle",
        "font-size": 12,
        fill: "currentColor",
      });
      marker.textContent = fret === 0 ? "○" : "×";
      svg.appendChild(marker);
      return;
    }
    const row = fret - baseFret;
    const cy = marginTop + (row + 0.5) * cellHeight;
    svg.appendChild(svgEl("circle", { cx: x, cy, r: 6, fill: "currentColor" }));
  });

  return svg;
}

function renderKeyboard(chord: ParsedChord): SVGElement {
  const pitchClasses = chordPitchClasses(chord);
  const rootClass = mod12(chord.rootSemitone);
  const whiteWidth = 16;
  const whiteHeight = 66;
  const blackWidth = 10;
  const blackHeight = 40;
  const octaves = 1;
  const whiteCount = WHITE_PITCH_CLASSES.length * octaves;
  const width = whiteCount * whiteWidth + 2;
  const height = whiteHeight + 2;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    class: "diagram-keyboard",
  });

  for (let octave = 0; octave < octaves; octave += 1) {
    WHITE_PITCH_CLASSES.forEach((pitchClass, whiteIndex) => {
      const x = (octave * WHITE_PITCH_CLASSES.length + whiteIndex) * whiteWidth + 1;
      const active = pitchClasses.has(pitchClass);
      const isRoot = pitchClass === rootClass;
      svg.appendChild(
        svgEl("rect", {
          x,
          y: 1,
          width: whiteWidth,
          height: whiteHeight,
          rx: 2,
          fill: active
            ? isRoot
              ? "var(--diagram-root)"
              : "var(--diagram-active)"
            : "var(--diagram-white)",
          stroke: "var(--diagram-line)",
          "stroke-width": 1,
        })
      );
    });
  }

  for (let octave = 0; octave < octaves; octave += 1) {
    WHITE_PITCH_CLASSES.forEach((pitchClass, whiteIndex) => {
      const blackClass = BLACK_AFTER_WHITE[pitchClass];
      if (blackClass === undefined) return;
      const baseX = (octave * WHITE_PITCH_CLASSES.length + whiteIndex) * whiteWidth + 1;
      const x = baseX + whiteWidth - blackWidth / 2;
      const active = pitchClasses.has(blackClass);
      const isRoot = blackClass === rootClass;
      svg.appendChild(
        svgEl("rect", {
          x,
          y: 1,
          width: blackWidth,
          height: blackHeight,
          rx: 1,
          fill: active
            ? isRoot
              ? "var(--diagram-root)"
              : "var(--diagram-active)"
            : "var(--diagram-black)",
          stroke: "var(--diagram-line)",
          "stroke-width": 1,
        })
      );
    });
  }

  return svg;
}

function textLine(className: string, text: string): HTMLParagraphElement {
  const node = document.createElement("p");
  node.className = className;
  node.textContent = text;
  return node;
}

export function renderDiagram(chord: ParsedChord | null, instrument: Instrument): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "diagram-body flex flex-col items-center gap-2";

  if (chord === null) {
    container.appendChild(
      textLine("text-sm text-muted-light dark:text-muted", "No diagram available.")
    );
    return container;
  }

  const heading = document.createElement("p");
  heading.className = "text-base font-semibold text-slate-900 dark:text-slate-100";
  heading.textContent = chord.raw;
  container.appendChild(heading);

  container.appendChild(
    textLine(
      "text-xs text-muted-light dark:text-muted",
      `${QUALITY_LABELS[chord.family]} · ${INSTRUMENT_LABELS[instrument]}`
    )
  );

  const shape = lookupShape(chord, instrument);
  if (shape === null) {
    container.appendChild(
      textLine(
        "text-xs text-muted-light dark:text-muted",
        `No stored ${INSTRUMENT_LABELS[instrument]} shape.`
      )
    );
  } else if (shape.kind === "piano") {
    container.appendChild(renderKeyboard(chord));
  } else {
    container.appendChild(renderFretboard(shape));
  }

  const notes = chordNotes(chord);
  container.appendChild(
    textLine("text-xs font-mono text-slate-700 dark:text-slate-300", notes.join(" · "))
  );

  return container;
}
