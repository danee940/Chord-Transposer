import { pluralise } from "./dom";
import { displayKey } from "./key-picker";
import {
  chordProToPlain,
  isChordProText,
  textToNashville,
  transposeChordProText,
  transposeChordProTextBySemitones,
  transposeText,
  transposeTextBySemitones,
  type Change,
} from "./transpose/index";

export const TRANSPOSE_MODES = ["key", "semitone", "nashville"] as const;

export type TransposeMode = (typeof TRANSPOSE_MODES)[number];
export type OutputFormat = "chordpro" | "plain";

export interface ChangePair {
  from: string;
  to: string;
}

export interface NashvilleResult {
  kind: "nashville";
  text: string;
  tonic: string;
}

export interface SemitoneResult {
  kind: "semitone";
  text: string;
  label: string;
  changes: ChangePair[];
  chordpro: boolean;
}

export interface KeyResult {
  kind: "key";
  text: string;
  from: string;
  to: string;
  changes: ChangePair[];
  chordpro: boolean;
}

export type PasteResult = NashvilleResult | SemitoneResult | KeyResult;

export interface ResultOptions {
  mode: TransposeMode;
  currentKey: string;
  targetKey: string;
  semitones: number;
  useFlats: boolean;
  outputFormat: OutputFormat;
  notation: boolean | undefined;
}

export function isTransposeMode(value: unknown): value is TransposeMode {
  return (TRANSPOSE_MODES as readonly unknown[]).includes(value);
}

export function semitoneLabel(count: number, useFlats: boolean): string {
  const accidental = useFlats ? "♭" : "♯";
  const sign = count > 0 ? "+" : "−";
  const magnitude = Math.abs(count);
  const unit = magnitude === 1 ? "semitone" : "semitones";
  return `${sign}${magnitude} ${unit} (${accidental})`;
}

function mapChanges(changes: Change[]): ChangePair[] {
  return changes.map(([from, to]) => ({ from, to }));
}

function maybePlain(text: string, chordpro: boolean, outputFormat: OutputFormat): string {
  return chordpro && outputFormat === "plain" ? chordProToPlain(text) : text;
}

export function computeResult(text: string, options: ResultOptions): PasteResult {
  const { mode, currentKey, targetKey, semitones, useFlats, outputFormat, notation } = options;

  if (mode === "nashville") {
    const result = textToNashville(text, currentKey, notation);
    return { kind: "nashville", text: result.text, tonic: result.tonic };
  }

  const chordpro = isChordProText(text);

  if (mode === "semitone") {
    const result = chordpro
      ? transposeChordProTextBySemitones(text, semitones, useFlats, notation)
      : transposeTextBySemitones(text, semitones, useFlats, notation);
    return {
      kind: "semitone",
      text: maybePlain(result.text, chordpro, outputFormat),
      label: semitoneLabel(semitones, useFlats),
      changes: mapChanges(result.changes),
      chordpro,
    };
  }

  const result = chordpro
    ? transposeChordProText(text, currentKey, targetKey, notation)
    : transposeText(text, currentKey, targetKey, notation);
  return {
    kind: "key",
    text: maybePlain(result.text, chordpro, outputFormat),
    from: result.from,
    to: result.to,
    changes: mapChanges(result.changes),
    chordpro,
  };
}

export function summariseResult(data: PasteResult): string {
  if (data.kind === "nashville") {
    return `Nashville · key of ${data.tonic}`;
  }
  const count = data.changes.length;
  const label = data.kind === "semitone" ? data.label : `${data.from} → ${data.to}`;
  return count > 0
    ? `${label} · ${pluralise(count, "chord")} changed`
    : `${label} · no chords found to change`;
}

export function stageTitle(data: PasteResult): string {
  if (data.kind === "nashville") return `Nashville numbers · key of ${displayKey(data.tonic)}`;
  if (data.kind === "semitone") return data.label;
  return `${displayKey(data.from)} → ${displayKey(data.to)}`;
}

export function resultChanges(data: PasteResult): ChangePair[] {
  return data.kind === "nashville" ? [] : data.changes;
}

export function isChordProResult(data: PasteResult): boolean {
  return data.kind !== "nashville" && data.chordpro;
}
