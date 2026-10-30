export function lineCount(text: string): number {
  return text.split("\n").length;
}

export function regroupLines(text: string, template: string[]): string[] {
  const lines = text.split("\n");
  let cursor = 0;
  return template.map((paragraph) => {
    const count = lineCount(paragraph);
    const chunk = lines.slice(cursor, cursor + count).join("\n");
    cursor += count;
    return chunk;
  });
}

function commonSubsequence(left: string[], right: string[]): [number, number][] {
  const width = right.length + 1;
  const table = new Uint32Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        left[i] === right[j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const matches: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      matches.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return matches;
}

const MAX_DIFF_CELLS = 4_000_000;

function commonPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  let length = 0;
  while (length < limit && left[length] === right[length]) length += 1;
  return length;
}

function commonSuffixLength(left: string[], right: string[], prefix: number): number {
  const limit = Math.min(left.length, right.length) - prefix;
  let length = 0;
  while (length < limit && left[left.length - 1 - length] === right[right.length - 1 - length]) {
    length += 1;
  }
  return length;
}

function positionalMatches(leftCount: number, rightCount: number): [number, number][] {
  return Array.from({ length: Math.min(leftCount, rightCount) }, (_, index) => [index, index]);
}

function lineMatches(generatedLines: string[], editedLines: string[]): [number, number][] {
  const prefix = commonPrefixLength(generatedLines, editedLines);
  const suffix = commonSuffixLength(generatedLines, editedLines, prefix);
  const middleGenerated = generatedLines.slice(prefix, generatedLines.length - suffix);
  const middleEdited = editedLines.slice(prefix, editedLines.length - suffix);
  const middle =
    middleGenerated.length * middleEdited.length > MAX_DIFF_CELLS
      ? positionalMatches(middleGenerated.length, middleEdited.length)
      : commonSubsequence(middleGenerated, middleEdited);
  const matches: [number, number][] = [];
  for (let index = 0; index < prefix; index += 1) matches.push([index, index]);
  for (const [left, right] of middle) matches.push([prefix + left, prefix + right]);
  for (let index = 0; index < suffix; index += 1) {
    matches.push([generatedLines.length - suffix + index, editedLines.length - suffix + index]);
  }
  return matches;
}

export function alignEditedParagraphs(generated: string[], editedText: string): string[] {
  const owners = generated.flatMap((paragraph, index) =>
    Array.from({ length: lineCount(paragraph) }, () => index)
  );
  const generatedLines = generated.join("\n").split("\n");
  const editedLines = editedText.split("\n");
  const buckets = generated.map((): string[] => []);
  let nextGenerated = 0;
  let nextEdited = 0;

  function placeBlock(generatedEnd: number, editedEnd: number): void {
    for (let offset = 0; nextEdited + offset < editedEnd; offset += 1) {
      let owner = 0;
      if (generatedEnd > nextGenerated) {
        owner = owners[Math.min(nextGenerated + offset, generatedEnd - 1)]!;
      } else if (nextGenerated > 0) {
        owner = owners[nextGenerated - 1]!;
      }
      buckets[owner]!.push(editedLines[nextEdited + offset]!);
    }
  }

  for (const [generatedIndex, editedIndex] of lineMatches(generatedLines, editedLines)) {
    placeBlock(generatedIndex, editedIndex);
    buckets[owners[generatedIndex]!]!.push(editedLines[editedIndex]!);
    nextGenerated = generatedIndex + 1;
    nextEdited = editedIndex + 1;
  }
  placeBlock(generatedLines.length, editedLines.length);
  return buckets.map((lines) => lines.join("\n"));
}
