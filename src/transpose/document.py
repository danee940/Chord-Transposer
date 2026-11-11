"""Reading and rewriting .docx chord sheets, run by run and story by story."""

from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from io import BytesIO
from typing import cast

from docx import Document
from docx.document import Document as DocumentObject
from docx.opc.constants import CONTENT_TYPE, RELATIONSHIP_TYPE
from docx.opc.part import PartFactory
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.oxml.text.paragraph import CT_P
from docx.oxml.text.run import CT_R
from docx.oxml.xmlchemy import BaseOxmlElement
from docx.parts.story import StoryPart
from docx.text.paragraph import Paragraph
from docx.text.run import Run

from .chords import (
    TOKEN_SPLIT_RE,
    is_chord_line,
    is_chord_token,
    line_uses_german,
    parse_chord_core,
    split_affixes,
)
from .detect import KeyDetection, detect_key
from .edits import ParagraphEdits, correction_for
from .errors import InvalidKeyError
from .notation import key_label, key_semitone, key_spelling, parse_key, transpose_note

PartFactory.part_type_for[CONTENT_TYPE.WML_FOOTNOTES] = StoryPart
PartFactory.part_type_for[CONTENT_TYPE.WML_ENDNOTES] = StoryPart


STORY_RELATIONSHIP_TYPES = {
    RELATIONSHIP_TYPE.HEADER,
    RELATIONSHIP_TYPE.FOOTER,
    RELATIONSHIP_TYPE.FOOTNOTES,
    RELATIONSHIP_TYPE.ENDNOTES,
}
PARAGRAPH_TAG = qn("w:p")
TEXT_BOX_CONTENT_TAG = qn("w:txbxContent")
MC_FALLBACK_TAG = "{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback"
RUN_TEXT_TAGS = {qn(f"w:{name}") for name in ("t", "tab", "br", "cr", "noBreakHyphen", "ptab")}


def _build_owner_map(runs: Sequence[Run]) -> tuple[str, list[int]]:
    """Return the concatenated run text and a list mapping each char to its run index."""
    text = ""
    owners = []
    for run_index, run in enumerate(runs):
        text += run.text
        owners.extend(run_index for _ in run.text)
    return text, owners


def _transpose_token_with_owners(
    chord: str,
    owners: list[int],
    semitones: int,
    spelling: Sequence[str],
    german: bool,
) -> tuple[str, list[int]]:
    """Transpose a chord and return (new_chord, new_owners) preserving per-char runs.

    Owners for the root and bass note come from the original note's first character,
    so the surrounding formatting (e.g. superscript suffix runs) is kept intact.
    """
    leading, core, trailing = split_affixes(chord)
    parts = parse_chord_core(core)
    if parts is None:
        return chord, owners

    segments: list[tuple[str, bool]] = [
        (leading, False),
        (parts.root, True),
        (parts.quality, False),
    ]
    if parts.bass is not None:
        segments += [("/", False), (parts.bass, True), (parts.bass_quality, False)]
    segments.append((trailing, False))

    new_chord = ""
    new_owners: list[int] = []
    cursor = 0
    for source, is_note in segments:
        if is_note:
            spelled = transpose_note(source, semitones, spelling, german)
            new_chord += spelled
            new_owners += [owners[cursor]] * len(spelled)
        else:
            new_chord += source
            new_owners += owners[cursor : cursor + len(source)]
        cursor += len(source)

    return new_chord, new_owners


def transpose_line_with_owners(
    text: str,
    owners: list[int],
    semitones: int,
    spelling: Sequence[str],
    german: bool,
    changes: set[tuple[str, str]] | None = None,
) -> tuple[str, list[int]]:
    """Transpose a chord line, returning (new_text, new_owners) aligned to source runs.

    When a ``changes`` set is supplied, every ``(original, transposed)`` chord
    pair is recorded so callers get the change summary from this single path.
    """
    leading_len = len(text) - len(text.lstrip())
    result = text[:leading_len]
    result_owners = list(owners[:leading_len])

    body = text[leading_len:]
    body_owners = owners[leading_len:]

    cursor = 0
    for token_match in TOKEN_SPLIT_RE.finditer(body):
        chord = token_match.group(1)
        trailing = token_match.group(2)
        start = token_match.start(1)
        chord_owners = body_owners[start : start + len(chord)]
        trailing_owners = body_owners[start + len(chord) : token_match.end(2)]

        if is_chord_token(chord):
            new_chord, new_chord_owners = _transpose_token_with_owners(
                chord, chord_owners, semitones, spelling, german
            )
        else:
            new_chord, new_chord_owners = chord, list(chord_owners)

        if changes is not None and new_chord != chord:
            changes.add((chord, new_chord))

        diff = len(new_chord) - len(chord)
        if diff > 0:
            drop = min(diff, len(trailing))
            trailing = trailing[drop:]
            trailing_owners = trailing_owners[drop:]
        elif diff < 0:
            pad_owner = new_chord_owners[-1] if new_chord_owners else _first_owner(body_owners)
            trailing += " " * (-diff)
            trailing_owners = list(trailing_owners) + [pad_owner] * (-diff)

        result += new_chord + trailing
        result_owners += new_chord_owners + list(trailing_owners)
        cursor = token_match.end(2)

    result += body[cursor:]
    result_owners += list(body_owners[cursor:])
    return result, result_owners


def _first_owner(owners: Sequence[int]) -> int:
    """Return the first owner index, defaulting to 0 for empty owner lists."""
    return owners[0] if owners else 0


def write_run_text(run: Run, text: str) -> None:
    """Replace a run's text while keeping its other content, such as drawings and fields.

    The new text takes the place of the first text element, so a chord written next to a
    text box anchor keeps the text box instead of deleting it as ``run.text = ...`` would.
    """
    element = run.element
    text_children = [child for child in element if child.tag in RUN_TEXT_TAGS]
    position = element.index(text_children[0]) if text_children else len(element)
    for child in text_children:
        element.remove(child)
    scratch = cast(CT_R, OxmlElement("w:r"))
    scratch.text = text
    for offset, child in enumerate(list(scratch)):
        element.insert(position + offset, child)


def redistribute_to_runs(
    paragraph: Paragraph,
    semitones: int,
    spelling: Sequence[str],
    german: bool,
    changes: set[tuple[str, str]] | None = None,
) -> None:
    """Transpose chord roots and write text back into runs, preserving formatting."""
    runs = paragraph.runs
    if not runs:
        return

    text, owners = _build_owner_map(runs)
    if not text:
        return

    new_text, new_owners = transpose_line_with_owners(
        text, owners, semitones, spelling, german, changes
    )

    run_texts = ["" for _ in runs]
    for char, owner in zip(new_text, new_owners, strict=True):
        run_texts[owner] += char

    for run, run_text in zip(runs, run_texts, strict=True):
        if run.text != run_text:
            write_run_text(run, run_text)


def process_paragraph(
    paragraph: Paragraph,
    semitones: int,
    spelling: Sequence[str],
    german: bool,
    changes: set[tuple[str, str]],
) -> None:
    """Transpose all chords in a paragraph if it is a chord line."""
    text = paragraph.text
    if not is_chord_line(text):
        return
    redistribute_to_runs(paragraph, semitones, spelling, german, changes)


def _common_affix_lengths(old: str, new: str) -> tuple[int, int]:
    """Return the lengths of the shared prefix and suffix of two strings."""
    limit = min(len(old), len(new))
    prefix = 0
    while prefix < limit and old[prefix] == new[prefix]:
        prefix += 1
    suffix = 0
    while suffix < limit - prefix and old[-1 - suffix] == new[-1 - suffix]:
        suffix += 1
    return prefix, suffix


def replace_paragraph_text(paragraph: Paragraph, new_text: str) -> None:
    """Replace a paragraph's text, keeping the formatting of every run left untouched.

    Only the span that differs between the current and the new text is rewritten,
    in the run(s) that own it, so an edited chord keeps its surrounding runs intact.
    Text that replaces alignment whitespace right after a run (a chord that grew)
    extends that run, so it keeps the chord's formatting. Paragraphs whose text is
    not fully owned by runs (hyperlinks) are left alone.
    """
    runs = paragraph.runs
    old_text = "".join(run.text for run in runs)
    if old_text != paragraph.text:
        return
    if not runs:
        paragraph.add_run(new_text)
        return

    prefix, suffix = _common_affix_lengths(old_text, new_text)
    start, end = prefix, len(old_text) - suffix
    replacement = new_text[prefix : len(new_text) - suffix]

    offsets: list[int] = []
    offset = 0
    for run in runs:
        offsets.append(offset)
        offset += len(run.text)

    first = len(runs) - 1
    for index, run in enumerate(runs):
        if offsets[index] + len(run.text) > start:
            first = index
            break
    if start > 0 and not old_text[start:end].strip():
        while first > 0 and offsets[first] == start:
            first -= 1
    last = first
    while offsets[last] + len(runs[last].text) < end:
        last += 1

    head = runs[first].text[: start - offsets[first]]
    tail = runs[last].text[end - offsets[last] :]
    if first == last:
        write_run_text(runs[first], head + replacement + tail)
        return
    write_run_text(runs[first], head + replacement)
    for middle in runs[first + 1 : last]:
        write_run_text(middle, "")
    write_run_text(runs[last], tail)


@dataclass(frozen=True)
class StoryParent:
    """The story part a paragraph read straight from the XML belongs to."""

    part: StoryPart


def iter_story_parts(document: DocumentObject) -> Iterator[StoryPart]:
    """Yield the document body part, then every header, footer, footnotes, and endnotes part.

    Parts are found through the document's relationships rather than its sections, so
    first-page and even-page headers and footers are included, a header shared by several
    sections is yielded once, and no missing header or footer part is created.
    """
    document_part = document.part
    yield document_part
    for relationship in document_part.rels.values():
        if relationship.is_external or relationship.reltype not in STORY_RELATIONSHIP_TYPES:
            continue
        part = relationship.target_part
        if isinstance(part, StoryPart):
            yield part


def _in_fallback(element: BaseOxmlElement) -> bool:
    """Return True if the element sits in a legacy fallback copy of a drawing (VML text box)."""
    return any(True for _ in element.iterancestors(MC_FALLBACK_TAG))


def _in_text_box(element: BaseOxmlElement) -> bool:
    """Return True if the element sits inside a text box or shape."""
    return any(True for _ in element.iterancestors(TEXT_BOX_CONTENT_TAG))


def _story_paragraphs(part: StoryPart) -> list[CT_P]:
    """Return every paragraph element in a story part, including nested ones, in order."""
    return [cast(CT_P, element) for element in part.element.iter(PARAGRAPH_TAG)]


def iter_body_paragraphs(document: DocumentObject) -> Iterator[Paragraph]:
    """Yield the body paragraphs, outside text boxes, that the upload preview shows."""
    parent = StoryParent(document.part)
    for element in _story_paragraphs(document.part):
        if not _in_text_box(element):
            yield Paragraph(element, parent)


def iter_paragraphs(
    document: DocumentObject, *, include_fallbacks: bool = False
) -> Iterator[Paragraph]:
    """Yield every paragraph in the document: body, tables, text boxes, headers, footers, notes.

    Text boxes are usually stored twice, as a drawing and as a legacy VML fallback. The
    fallback copy is skipped unless ``include_fallbacks`` is set, so readers see each text
    once while transposition can keep both copies in step.
    """
    for part in iter_story_parts(document):
        parent = StoryParent(part)
        for element in _story_paragraphs(part):
            if include_fallbacks or not _in_fallback(element):
                yield Paragraph(element, parent)


def detect_german(document: DocumentObject) -> bool:
    """Return True if any chord line in the document uses German note notation."""
    for paragraph in iter_paragraphs(document):
        text = paragraph.text
        if is_chord_line(text) and line_uses_german(text):
            return True
    return False


def _transpose_document(
    document: DocumentObject, semitones: int, spelling: Sequence[str], german: bool
) -> set[tuple[str, str]]:
    """Apply transposition to every paragraph in the document and return the change set."""
    changes: set[tuple[str, str]] = set()
    for paragraph in iter_paragraphs(document, include_fallbacks=True):
        process_paragraph(paragraph, semitones, spelling, german, changes)
    return changes


def detect_key_from_docx_bytes(file_bytes: bytes) -> KeyDetection:
    """Guess the key of a .docx chord sheet given as bytes (see ``detect_key``)."""
    document = Document(BytesIO(file_bytes))
    text = "\n".join(paragraph.text for paragraph in iter_paragraphs(document))
    return detect_key(text)


def transpose_document_bytes(
    file_bytes: bytes,
    current_key: str,
    target_key: str,
    edits: ParagraphEdits | None = None,
    german: bool | None = None,
) -> tuple[bytes, str, str, list[tuple[str, str]]]:
    """Transpose a .docx given as bytes and return (docx_bytes, from_label, to_label, changes).

    ``edits`` maps a body paragraph's position (as listed by ``iter_body_paragraphs``)
    to the correction the user made in the preview, applied after transposition.
    ``german`` overrides the notation detected in the document when the reader
    has corrected it; None keeps the detected value.
    """
    current = parse_key(current_key)
    if current is None:
        raise InvalidKeyError(f"'{current_key}' is not a valid key.")
    target = parse_key(target_key)
    if target is None:
        raise InvalidKeyError(f"'{target_key}' is not a valid key.")

    current_note, current_minor = current
    target_note, target_minor = target

    document = Document(BytesIO(file_bytes))
    if german is None:
        german = detect_german(document)

    semitones = (key_semitone(target_note, german) - key_semitone(current_note, german)) % 12
    spelling = key_spelling(target_note, target_minor, german)

    pending = [
        (paragraph, edited)
        for index, paragraph in enumerate(iter_body_paragraphs(document))
        if edits and (edited := correction_for(edits, index, paragraph.text)) is not None
    ]
    changes = _transpose_document(document, semitones, spelling, german)
    for paragraph, edited_text in pending:
        replace_paragraph_text(paragraph, edited_text)

    from_label = key_label(current_note, current_minor)
    to_label = key_label(target_note, target_minor)

    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)

    return buffer.getvalue(), from_label, to_label, sorted(changes)
