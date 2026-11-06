"""Write the .docx chord sheets the end-to-end tests upload.

Usage: ``python e2e/support/build_fixtures.py <output-directory>``
"""

import sys
from io import BytesIO
from pathlib import Path

from docx import Document

from samples import SAMPLE_FILENAME, amazing_grace_docx

GERMAN_SHEET = (
    ("H          E          Fis        H", "Stille Nacht, heilige Nacht"),
    ("E          H          Fis7       H", "Alles schläft, einsam wacht"),
)

SECOND_SONG = (
    ("G          D          Em         C", "This little light of mine"),
    ("G          D          G", "I'm gonna let it shine"),
)


def chord_sheet_docx(lines: tuple[tuple[str, str], ...]) -> bytes:
    """Build a .docx with one paragraph per chord line and per lyric line."""
    document = Document()
    for chords, lyric in lines:
        document.add_paragraph(chords)
        document.add_paragraph(lyric)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def build_fixtures(directory: Path) -> None:
    """Write every generated fixture into ``directory``."""
    directory.mkdir(parents=True, exist_ok=True)
    (directory / SAMPLE_FILENAME).write_bytes(amazing_grace_docx())
    (directory / "Stille_Nacht_H.docx").write_bytes(chord_sheet_docx(GERMAN_SHEET))
    (directory / "Little_Light_G.docx").write_bytes(chord_sheet_docx(SECOND_SONG))


if __name__ == "__main__":
    build_fixtures(Path(sys.argv[1]))
