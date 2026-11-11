"""Command-line entry point: transpose every .docx in input/ into output/."""

import sys
from pathlib import Path
from typing import cast

from docx import Document
from docx.document import Document as DocumentObject

from .document import _transpose_document, detect_german
from .notation import key_label, key_semitone, key_spelling, parse_key

PROJECT_ROOT = Path(__file__).parent.parent.parent
INPUT_DIR = PROJECT_ROOT / "input"
OUTPUT_DIR = PROJECT_ROOT / "output"


def find_input_file() -> Path | None:
    """Return the first .docx file in INPUT_DIR, or None if none exists."""
    docx_files = [p for p in INPUT_DIR.glob("*.docx") if not p.name.startswith("~$")]
    if not docx_files:
        return None
    return docx_files[0]


def _prompt_key(prompt_text: str) -> tuple[str, bool]:
    """Prompt the user for a key string, parse it, and exit on invalid input."""
    raw = input(prompt_text)
    parsed = parse_key(raw)
    if parsed is None:
        print(f"'{raw.strip()}' is not a valid key.")
        sys.exit(1)
    return parsed


def _save_and_report(
    document: DocumentObject,
    input_file: Path,
    from_label: str,
    to_label: str,
    changes: set[tuple[str, str]],
) -> None:
    """Save the transposed document and print a summary of chord changes."""
    OUTPUT_DIR.mkdir(exist_ok=True)
    output_file = OUTPUT_DIR / f"{input_file.stem}_{to_label}.docx"
    document.save(cast(str, output_file))

    print(f"\nSheet transposed from {from_label} to {to_label}\n")
    if changes:
        for original, transposed in sorted(changes):
            print(f"{original} -> {transposed}")
    else:
        print("No chords were changed.")
    print(f"\nSaved to: {output_file}")


def main() -> None:
    """Entry point: load the input file, prompt for keys, transpose, and save."""
    input_file = find_input_file()
    if input_file is None:
        print(f"No .docx file found in {INPUT_DIR}. Drop your sheet there first.")
        sys.exit(1)

    print(f"Found input file: {input_file.name}\n")

    current_note, current_minor = _prompt_key("Current key of the sheet (e.g. C, Am, F#): ")
    target_note, target_minor = _prompt_key("Desired key to transpose to (e.g. D, Bm, Eb): ")

    document = Document(str(input_file))
    german = detect_german(document)

    semitones = (key_semitone(target_note, german) - key_semitone(current_note, german)) % 12
    spelling = key_spelling(target_note, target_minor, german)

    changes = _transpose_document(document, semitones, spelling, german)

    from_label = key_label(current_note, current_minor)
    to_label = key_label(target_note, target_minor)

    _save_and_report(document, input_file, from_label, to_label, changes)
