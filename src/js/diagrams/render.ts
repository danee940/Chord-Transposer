import { mod12 } from "../transpose/notation";
import {
  INSTRUMENT_LABELS,
  QUALITY_INTERVALS,
  QUALITY_LABELS,
  chordNotes,
  lookupShape,
  type FrettedInstrument,
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

const OPEN_STRINGS: Readonly<Record<FrettedInstrument, readonly (readonly [string, number])[]>> = {
  guitar: [
    ["E", 4],
    ["A", 9],
    ["D", 2],
    ["G", 7],
    ["B", 11],
    ["E", 4],
  ],
  ukulele: [
    ["G", 7],
    ["C", 0],
    ["E", 4],
    ["A", 9],
  ],
};

export interface Barre {
  fret: number;
  from: number;
  to: number;
}

export function findBarre(frets: readonly number[]): Barre | null {
  if (frets.includes(0)) return null;
  const played = frets.filter((fret) => fret > 0);
  if (played.length === 0) return null;
  const fret = Math.min(...played);
  const from = frets.indexOf(fret);
  const to = frets.lastIndexOf(fret);
  if (from === to) return null;
  const spanned = frets.slice(from, to + 1);
  return spanned.every((value) => value >= fret) ? { fret, from, to } : null;
}

const MUTED = -1;

export function renderFretboard(shape: FrettedShape, chord: ParsedChord): SVGElement {
  const { frets, instrument } = shape;
  const strings = OPEN_STRINGS[instrument];
  const stringCount = strings.length;
  const { baseFret, fretCount } = fretWindow(frets);
  const rootClass = mod12(chord.rootSemitone);

  const cellWidth = 18;
  const cellHeight = 22;
  const marginLeft = 26;
  const marginTop = 26;
  const gridWidth = (stringCount - 1) * cellWidth;
  const gridHeight = fretCount * cellHeight;
  const width = marginLeft + gridWidth + 16;
  const height = marginTop + gridHeight + 22;

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
        "stroke-width": row === 0 && nutThick ? 4 : 1,
        "stroke-linecap": "square",
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
      x: marginLeft - 7,
      y: marginTop + cellHeight * 0.68,
      "text-anchor": "end",
      "font-size": 10,
      fill: "currentColor",
    });
    label.textContent = `${baseFret}fr`;
    svg.appendChild(label);
  }

  const barre = findBarre(frets);
  if (barre !== null) {
    const cy = marginTop + (barre.fret - baseFret + 0.5) * cellHeight;
    svg.appendChild(
      svgEl("rect", {
        class: "diagram-barre",
        x: marginLeft + barre.from * cellWidth - 7,
        y: cy - 7,
        width: (barre.to - barre.from) * cellWidth + 14,
        height: 14,
        rx: 7,
        fill: "currentColor",
      })
    );
  }

  strings.forEach(([name, openPitch], stringIndex) => {
    const x = marginLeft + stringIndex * cellWidth;
    const fret = frets.at(stringIndex) ?? MUTED;
    const fill =
      fret >= 0 && mod12(openPitch + fret) === rootClass ? "var(--diagram-root)" : "currentColor";
    if (fret <= 0) {
      const marker = svgEl("text", {
        x,
        y: marginTop - 9,
        "text-anchor": "middle",
        "font-size": 12,
        fill,
      });
      marker.textContent = fret === 0 ? "○" : "×";
      svg.appendChild(marker);
    } else {
      svg.appendChild(
        svgEl("circle", {
          cx: x,
          cy: marginTop + (fret - baseFret + 0.5) * cellHeight,
          r: 6.5,
          fill,
        })
      );
    }

    const label = svgEl("text", {
      class: "diagram-string",
      x,
      y: height - 5,
      "text-anchor": "middle",
      "font-size": 10,
      fill: "var(--diagram-muted)",
    });
    label.textContent = name;
    svg.appendChild(label);
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
    container.appendChild(textLine("text-sm text-graphite", "No diagram available."));
    return container;
  }

  const heading = document.createElement("p");
  heading.className = "font-serif text-xl font-semibold text-ink";
  heading.textContent = chord.raw;
  container.appendChild(heading);

  container.appendChild(
    textLine(
      "text-xs text-graphite",
      `${QUALITY_LABELS[chord.family]} · ${INSTRUMENT_LABELS[instrument]}`
    )
  );

  const shape = lookupShape(chord, instrument);
  if (shape === null) {
    container.appendChild(
      textLine("text-xs text-graphite", `No stored ${INSTRUMENT_LABELS[instrument]} shape.`)
    );
  } else if (shape.kind === "piano") {
    container.appendChild(renderKeyboard(chord));
  } else {
    container.appendChild(renderFretboard(shape, chord));
  }

  const notes = textLine("font-mono text-xs text-ink", "");
  notes.append(
    ...chordNotes(chord).map((note, index) => {
      if (index > 0) return ` · ${note}`;
      const root = document.createElement("span");
      root.className = "font-semibold text-vermilion";
      root.textContent = note;
      return root;
    })
  );
  container.appendChild(notes);

  return container;
}
