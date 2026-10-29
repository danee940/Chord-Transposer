import { isChordLine, isChordToken, lineUsesGerman, splitLinesKeepEnds, splitAffixes } from "../transpose/chords";

export type ChordActivation = (button: HTMLButtonElement) => void;

const TOKEN_SPLIT_RE = /(\s+)|(\S+)/g;
const BRACKET_RE = /\[([^\]]*)\]/g;

function textUsesGerman(text: string): boolean {
  for (const { content } of splitLinesKeepEnds(text)) {
    if (isChordLine(content) && lineUsesGerman(content)) return true;
  }
  return false;
}

function chordButton(
  displayText: string,
  chordSymbol: string,
  german: boolean,
  onActivate: ChordActivation | undefined
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chord-token";
  button.textContent = displayText;
  button.dataset.chord = chordSymbol;
  if (german) button.dataset.german = "1";
  button.setAttribute("aria-label", `Show ${chordSymbol} chord diagram`);
  if (onActivate) button.addEventListener("click", () => onActivate(button));
  return button;
}

function appendChordLine(
  target: Node,
  content: string,
  german: boolean,
  onActivate: ChordActivation | undefined
): void {
  TOKEN_SPLIT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_SPLIT_RE.exec(content)) !== null) {
    const whitespace = match[1];
    if (whitespace !== undefined) {
      target.appendChild(document.createTextNode(whitespace));
      continue;
    }
    const token = match[2]!;
    if (isChordToken(token)) {
      const { core } = splitAffixes(token);
      target.appendChild(chordButton(token, core, german, onActivate));
    } else {
      target.appendChild(document.createTextNode(token));
    }
  }
}

function appendLyricLine(
  target: Node,
  content: string,
  german: boolean,
  onActivate: ChordActivation | undefined
): void {
  BRACKET_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BRACKET_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      target.appendChild(document.createTextNode(content.slice(lastIndex, match.index)));
    }
    const inner = match[1]!;
    if (inner !== "" && isChordToken(inner)) {
      target.appendChild(document.createTextNode("["));
      const { core } = splitAffixes(inner);
      target.appendChild(chordButton(inner, core, german, onActivate));
      target.appendChild(document.createTextNode("]"));
    } else {
      target.appendChild(document.createTextNode(match[0]));
    }
    lastIndex = BRACKET_RE.lastIndex;
  }
  if (lastIndex < content.length) {
    target.appendChild(document.createTextNode(content.slice(lastIndex)));
  }
}

export function buildInteractiveOutput(text: string, onActivate?: ChordActivation): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const german = textUsesGerman(text);
  for (const { content, ending } of splitLinesKeepEnds(text)) {
    if (isChordLine(content)) {
      appendChordLine(fragment, content, german, onActivate);
    } else {
      appendLyricLine(fragment, content, german, onActivate);
    }
    if (ending !== "") fragment.appendChild(document.createTextNode(ending));
  }
  return fragment;
}
