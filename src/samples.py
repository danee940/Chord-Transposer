"""Sample chord sheets for trying the app locally and for the integration tests.

Run ``python src/samples.py`` to write ``input/Amazing_Grace_C.docx``.
"""

from io import BytesIO
from pathlib import Path

from docx import Document
from docx.shared import Pt

SAMPLE_FILENAME = "Amazing_Grace_C.docx"

VERSE_ONE = (
    ("C          C7         F          C", "Amazing grace, how sweet the sound"),
    ("                      C          G    G7", "That saved a wretch like me"),
    ("C          C7         F          C", "I once was lost, but now am found"),
    ("           Am         G7         C", "Was blind, but now I see"),
)

VERSE_TWO = (
    ("C          C7         F          C", "'Twas grace that taught my heart to fear"),
    ("                      C          G    G7", "And grace my fears relieved"),
    ("C          C7         F          C", "How precious did that grace appear"),
    ("           Am         G7         C", "The hour I first believed"),
)

CHORUS_CHORDS = "F          C          Am         G"
CHORUS_LINES = ("My chains are gone, I've been set free", "My God, my Saviour has ransomed me")


def amazing_grace_docx() -> bytes:
    """Build the Amazing Grace sample sheet in C as .docx bytes.

    The sheet mixes the structures the transposer has to cope with: bold and
    italic runs inside chord lines, a paragraph with a soft line break, a chord
    table, and chords in the page header.
    """
    document = Document()
    document.sections[0].header.paragraphs[0].text = "Amazing Grace — chord sheet (C)"
    document.sections[0].footer.paragraphs[0].text = "Traditional · John Newton, 1779"

    title = document.add_paragraph()
    title_run = title.add_run("Amazing Grace")
    title_run.bold = True
    title_run.font.size = Pt(20)
    subtitle = document.add_paragraph()
    subtitle.add_run("Key of C · 3/4 · John Newton, 1779").italic = True

    document.add_paragraph()
    document.add_paragraph().add_run("Verse 1").bold = True
    for index, (chords, lyric) in enumerate(VERSE_ONE):
        if index == 0:
            chord_line = document.add_paragraph()
            chord_line.add_run(chords[:22])
            chord_line.add_run(chords[22:23]).bold = True
            chord_line.add_run(chords[23:])
        else:
            document.add_paragraph(chords)
        document.add_paragraph(lyric)

    document.add_paragraph()
    document.add_paragraph().add_run("Chorus").bold = True
    document.add_paragraph(CHORUS_CHORDS)
    chorus = document.add_paragraph()
    chorus.add_run(CHORUS_LINES[0])
    chorus.add_run("\n" + CHORUS_LINES[1]).italic = True

    document.add_paragraph()
    document.add_paragraph().add_run("Verse 2").bold = True
    for chords, lyric in VERSE_TWO:
        document.add_paragraph(chords)
        document.add_paragraph(lyric)

    document.add_paragraph()
    document.add_paragraph().add_run("Chords used").bold = True
    table = document.add_table(rows=2, cols=2)
    table.rows[0].cells[0].text = "Main"
    table.rows[0].cells[1].text = "C  C7  F  G  G7"
    table.rows[1].cells[0].text = "Colour"
    table.rows[1].cells[1].text = "Am  Dm  Em"

    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def write_sample(directory: Path) -> Path:
    """Write the sample sheet into ``directory`` and return its path."""
    directory.mkdir(exist_ok=True)
    target = directory / SAMPLE_FILENAME
    target.write_bytes(amazing_grace_docx())
    return target


if __name__ == "__main__":
    print(f"Wrote {write_sample(Path(__file__).resolve().parent.parent / 'input')}")
