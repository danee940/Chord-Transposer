"""Preview corrections carried from the browser into a transposed sheet."""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class ParagraphEdit:
    """A preview correction: the paragraph's original text and the text it should end up with."""

    source: str
    text: str


ParagraphEdits = Mapping[int, ParagraphEdit]


def correction_for(edits: ParagraphEdits, index: int, original: str) -> str | None:
    """Return the correction for the paragraph at ``index``, if it still reads ``original``.

    Edits are matched by position so a correction to one of several identical
    paragraphs changes only that one; the source text guards against applying it
    to a different paragraph when the preview and the document disagree.
    """
    edit = edits.get(index)
    return edit.text if edit is not None and edit.source == original else None


def apply_line_edits(source: str, result: str, edits: ParagraphEdits) -> str:
    """Replace transposed lines whose source line was edited in the preview."""
    parts: list[str] = []
    for index, (original, transposed) in enumerate(
        zip(source.splitlines(keepends=True), result.splitlines(keepends=True), strict=True)
    ):
        edited = correction_for(edits, index, original.splitlines()[0])
        if edited is None:
            parts.append(transposed)
            continue
        content = transposed.splitlines()[0]
        parts.append(edited + transposed[len(content) :])
    return "".join(parts)
