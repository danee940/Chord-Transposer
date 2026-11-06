const PDF_HEADER = "%PDF-";

function unescapePdfString(text: string): string {
  return text.replace(/\\([\\()])/g, "$1");
}

export function isPdf(pdf: Buffer): boolean {
  return pdf.subarray(0, PDF_HEADER.length).toString("latin1") === PDF_HEADER;
}

export function pdfPageCount(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
}

export function pdfTextLines(pdf: Buffer): string[] {
  const shownStrings = pdf.toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\)\s*'/g);
  return [...shownStrings].map(([, text]) => unescapePdfString(text ?? ""));
}
