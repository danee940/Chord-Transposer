"""Transpose chord sheets in .docx format between musical keys."""
# pylint: disable=too-many-locals,too-many-arguments,too-many-positional-arguments
# pylint: disable=too-many-lines,too-many-return-statements

import os
import re
import sys
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import NamedTuple, TypedDict, cast

import requests
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

DEFAULT_GOTENBERG_URL = "http://localhost:3000"
PDF_CONVERSION_TIMEOUT_SECONDS = 120

PROJECT_ROOT = Path(__file__).parent.parent
INPUT_DIR = PROJECT_ROOT / "input"
OUTPUT_DIR = PROJECT_ROOT / "output"

NOTE_TO_SEMITONE = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "Fb": 4,
    "E#": 5,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "Cb": 11,
    "B#": 0,
    "H": 11,
    "H#": 0,
}

GERMAN_NOTE_NAMES = {
    "C": 0,
    "Cis": 1,
    "Des": 1,
    "D": 2,
    "Dis": 3,
    "Es": 3,
    "Eis": 5,
    "E": 4,
    "Fes": 4,
    "F": 5,
    "Fis": 6,
    "Ges": 6,
    "G": 7,
    "Gis": 8,
    "As": 8,
    "A": 9,
    "Ais": 10,
    "B": 10,
    "His": 0,
    "H": 11,
    "Ces": 11,
}

GERMAN_NOTE_TO_SEMITONE = dict(NOTE_TO_SEMITONE)
GERMAN_NOTE_TO_SEMITONE["B"] = 10
GERMAN_NOTE_TO_SEMITONE["Bb"] = 9
GERMAN_NOTE_TO_SEMITONE.update(GERMAN_NOTE_NAMES)

GERMAN_ROOT_NAMES = sorted(GERMAN_NOTE_NAMES, key=len, reverse=True)
GERMAN_ONLY_ROOTS_KEYS = {name for name in GERMAN_NOTE_NAMES if name not in NOTE_TO_SEMITONE}

SHARP_KEYS = {"G", "D", "A", "E", "B", "F#", "C#", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m"}
FLAT_KEYS = {"F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"}

SHARP_SPELLING = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_SPELLING = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

GERMAN_SHARP_SPELLING = ["C", "Cis", "D", "Dis", "E", "F", "Fis", "G", "Gis", "A", "B", "H"]
GERMAN_FLAT_SPELLING = ["C", "Des", "D", "Es", "E", "F", "Ges", "G", "As", "A", "B", "H"]

ROOT_PATTERN = (
    r"(?:Cis|Des|Dis|Eis|Fis|Ges|Gis|Ais|His|Ces|Fes|Es|As"
    r"|[A-Ga-g](?:#|b|\u266f|\u266d)?|[Hh](?:#|\u266f)?(?![b\u266d]))"
)
QUALITY_PATTERN = (
    r"(?:maj|min|dim|aug|sus|add|alt|m|M|\+|°|ø|\u0394|\u2206"
    r"|\d|#|b|\u266f|\u266d|-|\(|\)|,|/(?=\d))*"
)
CHORD_TOKEN_RE = re.compile(
    rf"^({ROOT_PATTERN})({QUALITY_PATTERN})(?:/({ROOT_PATTERN})({QUALITY_PATTERN}))?$"
)
ROOT_MATCH_RE = re.compile(rf"^({ROOT_PATTERN})(.*)$")
TOKEN_SPLIT_RE = re.compile(r"(\S+)(\s*)")
CHORDPRO_BRACKET_RE = re.compile(r"\[([^\]]+)\]")

MAJOR_SCALE_DEGREES = {0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7"}
CHROMATIC_DEGREE_NAMES = {1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7"}


UNICODE_ACCIDENTALS = str.maketrans({"♯": "#", "♭": "b"})


def ascii_accidentals(note: str) -> str:
    """Rewrite Unicode sharp and flat signs in a note name as ASCII '#' and 'b'."""
    return note.translate(UNICODE_ACCIDENTALS)


def canonical_note(note: str) -> str:
    """Return a note name in the form the semitone tables are keyed by."""
    plain = ascii_accidentals(note)
    return plain[0].upper() + plain[1:]


def _match_accidental_style(spelled: str, source: str) -> str:
    """Spell a note with Unicode accidentals when the note it came from used them."""
    if "♯" in source or "♭" in source:
        return spelled.replace("#", "♯").replace("b", "♭")
    return spelled


def _is_minor_suffix(rest: str) -> bool:
    """Return True if the trailing text denotes a minor key."""
    return rest.strip().lower() in ("m", "min", "minor")


def parse_key(raw: str) -> tuple[str, bool] | None:
    """Parse a raw key string into a (note, is_minor) tuple, or None if invalid."""
    text = ascii_accidentals(raw.strip())
    if not text:
        return None

    for name in GERMAN_ROOT_NAMES:
        if len(name) > 1 and text[: len(name)].capitalize() == name:
            rest = text[len(name) :]
            if rest == "" or _is_minor_suffix(rest):
                return name, _is_minor_suffix(rest)

    root = text[0].upper()
    rest = text[1:]
    accidental = ""
    if rest and rest[0] in "#b":
        accidental = rest[0]
        rest = rest[1:]
    note = root + accidental
    if note not in NOTE_TO_SEMITONE:
        return None
    return note, _is_minor_suffix(rest)


def key_label(note: str, minor: bool) -> str:
    """Return the key label string, appending 'm' for minor keys."""
    return note + ("m" if minor else "")


def prefers_flats(target_note: str, target_minor: bool) -> bool:
    """Return True if the target key conventionally uses flat spelling."""
    label = key_label(target_note, target_minor)
    if label in FLAT_KEYS or target_note in FLAT_KEYS:
        return True
    if label in SHARP_KEYS or target_note in SHARP_KEYS:
        return False
    return True


def choose_spelling(use_flats: bool, german: bool) -> list[str]:
    """Return the appropriate chromatic spelling list for the given preferences."""
    if german:
        return GERMAN_FLAT_SPELLING if use_flats else GERMAN_SHARP_SPELLING
    return FLAT_SPELLING if use_flats else SHARP_SPELLING


NATURAL_LETTER_SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
LETTER_ORDER = "CDEFGAB"
MAJOR_SCALE_INTERVALS = (0, 2, 4, 5, 7, 9, 11)
MINOR_SCALE_INTERVALS = (0, 2, 3, 5, 7, 8, 10)


def _spell_letter(letter: str, accidental: int, german: bool) -> str:
    """Spell a letter plus accidental (-1, 0, or 1) in English or German notation."""
    if not german:
        return letter + {1: "#", -1: "b", 0: ""}[accidental]
    if accidental == 1:
        return "His" if letter == "B" else letter + "is"
    if accidental == -1:
        if letter == "B":
            return "B"
        if letter in ("E", "A"):
            return letter + "s"
        return letter + "es"
    return "H" if letter == "B" else letter


def key_spelling(note: str, minor: bool, german: bool) -> list[str]:
    """Return a chromatic spelling list tailored to the target key.

    Diatonic notes of the target key's major or natural minor scale are spelled
    by scale degree (giving e.g. Cb in Gb major or E# in F# major), and minor
    keys also spell their harmonic-minor leading tone as a raised seventh
    (C# in D minor, E# in F# minor). The remaining chromatic notes keep the
    key's conventional sharp or flat spelling, and degrees that would need a
    double accidental fall back to it.
    """
    spelling = list(choose_spelling(prefers_flats(note, minor), german))
    letter = note[0].upper()
    if letter == "H":
        letter = "B"
    tonic = key_semitone(note, german)
    intervals = MINOR_SCALE_INTERVALS if minor else MAJOR_SCALE_INTERVALS
    start = LETTER_ORDER.index(letter)
    degrees = list(enumerate(intervals))
    if minor:
        degrees.append((6, 11))
    for degree, interval in degrees:
        semitone = (tonic + interval) % 12
        degree_letter = LETTER_ORDER[(start + degree) % 7]
        accidental = (semitone - NATURAL_LETTER_SEMITONES[degree_letter] + 6) % 12 - 6
        if -1 <= accidental <= 1:
            spelling[semitone] = _spell_letter(degree_letter, accidental, german)
    return spelling


def note_semitone(note: str, german: bool) -> int:
    """Return the semitone index (0–11) for a note name.

    Only B and Bb mean different pitches in the two notations, so a German-only
    name such as Es keeps its meaning when the reader forces English notation
    rather than failing the lookup.
    """
    key = canonical_note(note)
    table = GERMAN_NOTE_TO_SEMITONE if german else NOTE_TO_SEMITONE
    semitone = table.get(key)
    if semitone is None:
        return GERMAN_NOTE_TO_SEMITONE[key]
    return semitone


def key_semitone(note: str, german: bool) -> int:
    """Return the semitone index for a parsed key note.

    German-only names such as Es or Cis resolve via the German table regardless
    of the document flag, while ambiguous names (e.g. B) keep their meaning for
    the active notation so an English key B stays B natural.
    """
    canonical = canonical_note(note)
    if canonical in GERMAN_ONLY_ROOTS_KEYS:
        return GERMAN_NOTE_TO_SEMITONE[canonical]
    return note_semitone(canonical, german)


def transpose_note(note: str, semitones: int, spelling: Sequence[str], german: bool) -> str:
    """Transpose a single note name by the given number of semitones."""
    semitone = (note_semitone(note, german) + semitones) % 12
    return _match_accidental_style(spelling[semitone], note)


PUNCTUATION = "().,;:…\"'-"


def split_affixes(token: str) -> tuple[str, str, str]:
    """Split a token into (leading_punctuation, core, trailing_punctuation)."""
    start = 0
    while start < len(token) and token[start] in PUNCTUATION:
        start += 1
    end = len(token)
    while end > start and token[end - 1] in PUNCTUATION:
        end -= 1
    return token[:start], token[start:end], token[end:]


class ChordParts(NamedTuple):
    """A chord symbol split into its root, quality, and optional bass note."""

    root: str
    quality: str
    bass: str | None
    bass_quality: str


def parse_chord_core(core: str) -> ChordParts | None:
    """Split a bare chord symbol into its parts, or return None if it is not a chord."""
    match = CHORD_TOKEN_RE.match(core)
    if match is None:
        return None
    return ChordParts(match.group(1), match.group(2), match.group(3), match.group(4) or "")


def map_chord_roots(chord: str, map_root: Callable[[str], str]) -> str:
    """Rewrite the root and bass of a chord symbol, keeping its quality and punctuation."""
    leading, core, trailing = split_affixes(chord)
    parts = parse_chord_core(core)
    if parts is None:
        return chord
    bass = "" if parts.bass is None else f"/{map_root(parts.bass)}{parts.bass_quality}"
    return f"{leading}{map_root(parts.root)}{parts.quality}{bass}{trailing}"


def transpose_chord(chord: str, semitones: int, spelling: Sequence[str], german: bool) -> str:
    """Transpose a chord symbol (including optional bass note) by semitones."""
    return map_chord_roots(chord, lambda root: transpose_note(root, semitones, spelling, german))


def is_chord_token(token: str) -> bool:
    """Return True if the bare token (ignoring surrounding punctuation) is a chord symbol."""
    core = token.strip("().,;:…\"'-")
    return bool(core) and bool(CHORD_TOKEN_RE.match(core))


def _is_decoration(token: str) -> bool:
    """Return True if a non-chord token is punctuation or a section label, not a lyric word."""
    _, core, _ = split_affixes(token)
    if core == "":
        return True
    if core.endswith(":") or ":" in token:
        return True
    return core.isupper()


def is_chord_line(text: str) -> bool:
    """Return True if the line is a chord line rather than lyrics.

    A line qualifies when every token is a chord symbol, or when it contains at
    least one chord and every remaining token is a decoration (punctuation or a
    section label). This tolerates lines like '(Vége: Es B/d F/c B )' while
    still rejecting lyric lines that merely contain a stray chord-like word.
    """
    tokens = text.split()
    if not tokens:
        return False
    chord_count = 0
    for token in tokens:
        if is_chord_token(token):
            chord_count += 1
        elif not _is_decoration(token):
            return False
    return chord_count > 0


GERMAN_ONLY_ROOTS = {name.upper() for name in GERMAN_NOTE_NAMES if len(name) > 1}
GERMAN_ONLY_ROOTS.add("H")


def _token_roots(token: str) -> Iterator[str]:
    """Yield each note root (main and bass) found in a chord token."""
    _, core, _ = split_affixes(token)
    for part in core.split("/"):
        match = ROOT_MATCH_RE.match(part)
        if match:
            yield match.group(1)


def line_uses_german(text: str) -> bool:
    """Return True if the line contains an unambiguously German note name (H, Es, As, Cis…)."""
    for token in text.split():
        for root in _token_roots(token):
            if root.upper() in GERMAN_ONLY_ROOTS:
                return True
    return False


def transpose_line_text(
    text: str,
    semitones: int,
    spelling: Sequence[str],
    german: bool,
    changes: set[tuple[str, str]],
) -> str:
    """Transpose all chord tokens in a line, preserving spacing, and record changes."""
    leading = text[: len(text) - len(text.lstrip())]
    body = text[len(leading) :]
    result = leading

    for token_match in TOKEN_SPLIT_RE.finditer(body):
        chord = token_match.group(1)
        trailing = token_match.group(2)
        if is_chord_token(chord):
            transposed = transpose_chord(chord, semitones, spelling, german)
        else:
            transposed = chord
        if transposed != chord:
            changes.add((chord, transposed))

        diff = len(transposed) - len(chord)
        if diff > 0:
            trailing = trailing[min(diff, len(trailing)) :]
        elif diff < 0:
            trailing = trailing + " " * (-diff)
        result += transposed + trailing

    return result


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


ParagraphEdits = Mapping[str, str]


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


def apply_line_edits(source: str, result: str, edits: ParagraphEdits) -> str:
    """Replace transposed lines whose source line was edited in the preview."""
    parts: list[str] = []
    for original, transposed in zip(
        source.splitlines(keepends=True), result.splitlines(keepends=True), strict=True
    ):
        edited = edits.get(original.splitlines()[0])
        if edited is None:
            parts.append(transposed)
            continue
        content = transposed.splitlines()[0]
        parts.append(edited + transposed[len(content) :])
    return "".join(parts)


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


def _transpose_document(
    document: DocumentObject, semitones: int, spelling: Sequence[str], german: bool
) -> set[tuple[str, str]]:
    """Apply transposition to every paragraph in the document and return the change set."""
    changes: set[tuple[str, str]] = set()
    for paragraph in iter_paragraphs(document, include_fallbacks=True):
        process_paragraph(paragraph, semitones, spelling, german, changes)
    return changes


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


class InvalidKeyError(ValueError):
    """Raised when a supplied key string cannot be parsed."""


class PdfConversionError(RuntimeError):
    """Raised when a .docx cannot be converted to PDF."""


def _gotenberg_url() -> str:
    """Return the base URL of the Gotenberg conversion service."""
    return (os.environ.get("GOTENBERG_URL") or DEFAULT_GOTENBERG_URL).rstrip("/")


def convert_docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Convert .docx bytes to PDF bytes via the Gotenberg conversion service."""
    endpoint = f"{_gotenberg_url()}/forms/libreoffice/convert"
    files = {
        "files": (
            "sheet.docx",
            docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }

    try:
        response = requests.post(endpoint, files=files, timeout=PDF_CONVERSION_TIMEOUT_SECONDS)
    except requests.Timeout as exc:
        raise PdfConversionError("PDF conversion timed out.") from exc
    except requests.RequestException as exc:
        raise PdfConversionError("Could not reach the PDF conversion service.") from exc

    if response.status_code != 200:
        raise PdfConversionError("The PDF conversion service failed to convert the document.")

    return response.content


def _text_uses_german(text: str) -> bool:
    """Return True if any chord line in the text uses German note notation."""
    for line in text.splitlines():
        if is_chord_line(line) and line_uses_german(line):
            return True
    return False


def _transpose_text_core(
    text: str, semitones: int, spelling: Sequence[str], german: bool
) -> tuple[str, list[tuple[str, str]]]:
    """Transpose chord lines in plain text by a semitone count, returning (text, changes).

    Only lines detected as chord lines are transposed; lyric and blank lines are
    left untouched.
    """
    changes: set[tuple[str, str]] = set()
    result_parts = []
    for segment in text.splitlines(keepends=True):
        content = segment.splitlines()[0]
        ending = segment[len(content) :]
        if is_chord_line(content):
            content = transpose_line_text(content, semitones, spelling, german, changes)
        result_parts.append(content + ending)

    return "".join(result_parts), sorted(changes)


def transpose_text(
    text: str, current_key: str, target_key: str, german: bool | None = None
) -> tuple[str, str, str, list[tuple[str, str]]]:
    """Transpose chord lines in plain text and return (text, from_label, to_label, changes).

    Only lines detected as chord lines are transposed; lyric and blank lines are
    left untouched. Notation, spelling, and German H handling match the .docx path.
    """
    current = parse_key(current_key)
    if current is None:
        raise InvalidKeyError(f"'{current_key}' is not a valid key.")
    target = parse_key(target_key)
    if target is None:
        raise InvalidKeyError(f"'{target_key}' is not a valid key.")

    current_note, current_minor = current
    target_note, target_minor = target

    german = _text_uses_german(text) if german is None else german
    semitones = (key_semitone(target_note, german) - key_semitone(current_note, german)) % 12
    spelling = key_spelling(target_note, target_minor, german)

    result, changes = _transpose_text_core(text, semitones, spelling, german)

    from_label = key_label(current_note, current_minor)
    to_label = key_label(target_note, target_minor)

    return result, from_label, to_label, changes


def transpose_text_by_semitones(
    text: str, semitones: int, use_flats: bool, german: bool | None = None
) -> tuple[str, int, list[tuple[str, str]]]:
    """Transpose chord lines in plain text by a raw semitone shift.

    ``semitones`` may be any integer; it is normalised to the 0-11 range. The
    ``use_flats`` flag selects flat spelling over sharp spelling. Returns
    ``(text, normalised_semitones, changes)``. Unlike the key-based path this
    ignores musical key context, so the caller chooses the accidental style.
    """
    normalised = semitones % 12
    german = _text_uses_german(text) if german is None else german
    spelling = choose_spelling(use_flats, german)
    result, changes = _transpose_text_core(text, normalised, spelling, german)
    return result, normalised, changes


def is_chordpro_text(text: str) -> bool:
    """Return True if any line contains an inline ChordPro chord like ``[C]``."""
    for line in text.splitlines():
        for token in CHORDPRO_BRACKET_RE.findall(line):
            if CHORD_TOKEN_RE.match(token.strip()):
                return True
    return False


def _chordpro_uses_german(text: str) -> bool:
    """Return True if any ChordPro bracket token uses German note notation."""
    for token in CHORDPRO_BRACKET_RE.findall(text):
        stripped = token.strip()
        if CHORD_TOKEN_RE.match(stripped) and line_uses_german(stripped):
            return True
    return False


def _transpose_chordpro_line(
    line: str,
    semitones: int,
    spelling: Sequence[str],
    german: bool,
    changes: set[tuple[str, str]],
) -> str:
    """Transpose each bracketed chord token in a line, leaving other content verbatim."""

    def replace(match: re.Match[str]) -> str:
        token = match.group(1)
        if not CHORD_TOKEN_RE.match(token.strip()):
            return match.group(0)
        transposed = transpose_chord(token, semitones, spelling, german)
        if transposed != token:
            changes.add((token, transposed))
        return f"[{transposed}]"

    return CHORDPRO_BRACKET_RE.sub(replace, line)


def chordpro_to_plain(text: str) -> str:
    """Strip ChordPro brackets, returning only the chord tokens per line."""
    result_parts = []
    for segment in text.splitlines(keepends=True):
        content = segment.splitlines()[0] if segment.splitlines() else ""
        ending = segment[len(content) :]
        tokens = [token.strip() for token in CHORDPRO_BRACKET_RE.findall(content)]
        result_parts.append(" ".join(tokens) + ending)
    return "".join(result_parts)


def _transpose_chordpro_core(
    text: str, semitones: int, spelling: Sequence[str], german: bool
) -> tuple[str, list[tuple[str, str]]]:
    """Transpose ChordPro chord tokens across all lines, returning (text, changes)."""
    changes: set[tuple[str, str]] = set()
    result_parts = []
    for segment in text.splitlines(keepends=True):
        content = segment.splitlines()[0] if segment.splitlines() else ""
        ending = segment[len(content) :]
        content = _transpose_chordpro_line(content, semitones, spelling, german, changes)
        result_parts.append(content + ending)
    return "".join(result_parts), sorted(changes)


def transpose_chordpro_text(
    text: str, current_key: str, target_key: str, german: bool | None = None
) -> tuple[str, str, str, list[tuple[str, str]]]:
    """Transpose ChordPro chord tokens and return (text, from_label, to_label, changes)."""
    current = parse_key(current_key)
    if current is None:
        raise InvalidKeyError(f"'{current_key}' is not a valid key.")
    target = parse_key(target_key)
    if target is None:
        raise InvalidKeyError(f"'{target_key}' is not a valid key.")

    current_note, current_minor = current
    target_note, target_minor = target

    german = _chordpro_uses_german(text) if german is None else german
    semitones = (key_semitone(target_note, german) - key_semitone(current_note, german)) % 12
    spelling = key_spelling(target_note, target_minor, german)

    result, changes = _transpose_chordpro_core(text, semitones, spelling, german)

    from_label = key_label(current_note, current_minor)
    to_label = key_label(target_note, target_minor)

    return result, from_label, to_label, changes


def transpose_chordpro_text_by_semitones(
    text: str, semitones: int, use_flats: bool, german: bool | None = None
) -> tuple[str, int, list[tuple[str, str]]]:
    """Transpose ChordPro chord tokens by a raw semitone shift.

    Returns ``(text, normalised_semitones, changes)`` mirroring
    ``transpose_text_by_semitones`` for the plain-text path.
    """
    normalised = semitones % 12
    german = _chordpro_uses_german(text) if german is None else german
    spelling = choose_spelling(use_flats, german)
    result, changes = _transpose_chordpro_core(text, normalised, spelling, german)
    return result, normalised, changes


DETECT_MIN_CHORDS = 3
DETECT_MIN_DISTINCT_ROOTS = 2
DETECT_AMBIGUITY_PERCENT = 15
DETECT_BASE_WEIGHT = 2
DETECT_EDGE_BONUS = 3
DETECT_LINE_END_BONUS = 1

OUT_OF_SCALE_FIT = -3

MAJOR_DEGREE_FITS: dict[int, dict[str, int]] = {
    0: {"major": 6, "dom7": 4, "other": 4, "minor": 1, "dim": 1},
    2: {"minor": 3, "dom7": 2, "other": 2, "major": 1, "dim": 1},
    4: {"minor": 3, "major": 1, "dom7": 1, "other": 1, "dim": 1},
    5: {"major": 4, "other": 3, "minor": 2, "dom7": 1, "dim": 1},
    7: {"dom7": 6, "major": 5, "other": 4, "minor": 1, "dim": 1},
    9: {"minor": 3, "major": 1, "dom7": 1, "other": 1, "dim": 1},
    10: {"major": 2, "dom7": 0, "other": 0, "minor": 0, "dim": 0},
    11: {"dim": 3, "major": 1, "minor": 1, "dom7": 1, "other": 1},
}

MINOR_DEGREE_FITS: dict[int, dict[str, int]] = {
    0: {"minor": 6, "other": 4, "major": 1, "dom7": 1, "dim": 1},
    2: {"dim": 2, "minor": 2, "major": 1, "dom7": 1, "other": 1},
    3: {"major": 4, "other": 2, "dom7": 2, "minor": 1, "dim": 1},
    5: {"minor": 4, "major": 2, "dom7": 2, "other": 2, "dim": 1},
    7: {"dom7": 6, "major": 5, "minor": 4, "other": 3, "dim": 1},
    8: {"major": 3, "other": 2, "minor": 1, "dom7": 1, "dim": 1},
    10: {"major": 3, "dom7": 2, "other": 2, "minor": 1, "dim": 1},
    11: {"dim": 2, "major": 1, "minor": 1, "dom7": 1, "other": 1},
}


def _chord_quality(quality: str) -> str:
    """Classify a chord's quality from the text after its root."""
    if quality == "":
        return "major"
    low = quality.lower()
    if low.startswith("maj"):
        return "major"
    if low.startswith("dim"):
        return "dim"
    if low.startswith("alt"):
        return "dom7"
    first = quality[0]
    if first in "°ø":
        return "dim"
    if first in "Δ∆":
        return "major"
    if first == "M":
        return "major"
    if first in "m-":
        return "minor"
    if first in "791":
        return "dom7"
    return "other"


def _detect_chord_tokens(text: str) -> tuple[list[tuple[str, bool]], bool]:
    """Return ((core, line_last) tokens in sheet order, german flag) for detection."""
    tokens: list[tuple[str, bool]] = []
    if is_chordpro_text(text):
        german = _chordpro_uses_german(text)
        for line in text.splitlines():
            cores = [
                stripped
                for stripped in (token.strip() for token in CHORDPRO_BRACKET_RE.findall(line))
                if CHORD_TOKEN_RE.match(stripped)
            ]
            tokens.extend((core, index == len(cores) - 1) for index, core in enumerate(cores))
        return tokens, german

    german = _text_uses_german(text)
    for line in text.splitlines():
        if not is_chord_line(line):
            continue
        cores = []
        for token in line.split():
            _, core, _ = split_affixes(token)
            if core and CHORD_TOKEN_RE.match(core):
                cores.append(core)
        tokens.extend((core, index == len(cores) - 1) for index, core in enumerate(cores))
    return tokens, german


def _detect_observations(text: str) -> tuple[list[tuple[int, str, int]], bool, int, int]:
    """Return ((semitone, quality, weight) observations, german, total, distinct roots).

    Lowercase roots count as minor chords only when the sheet mixes upper- and
    lowercase roots: mixed case signals the German/Hungarian convention, while a
    uniformly lowercase sheet is just sloppy typing and carries no quality cue.
    """
    tokens, german = _detect_chord_tokens(text)
    parsed: list[tuple[str, str, bool]] = []
    for core, line_last in tokens:
        parts = parse_chord_core(core)
        assert parts is not None
        parsed.append((parts.root, parts.quality, line_last))
    has_upper = any(root[0].isupper() for root, _, _ in parsed)
    has_lower = any(root[0].islower() for root, _, _ in parsed)
    lowercase_means_minor = has_upper and has_lower

    observations: list[tuple[int, str, int]] = []
    roots: set[int] = set()
    for index, (root, remainder, line_last) in enumerate(parsed):
        semitone = note_semitone(root, german)
        quality = _chord_quality(remainder)
        if lowercase_means_minor and root[0].islower() and quality == "major":
            quality = "minor"
        weight = DETECT_BASE_WEIGHT
        if index == 0:
            weight += DETECT_EDGE_BONUS
        if index == len(parsed) - 1:
            weight += DETECT_EDGE_BONUS
        if line_last:
            weight += DETECT_LINE_END_BONUS
        observations.append((semitone, quality, weight))
        roots.add(semitone)
    return observations, german, len(observations), len(roots)


def _score_key_candidates(
    observations: Sequence[tuple[int, str, int]],
) -> list[tuple[int, bool, int]]:
    """Score all 24 keys, returning (score, minor, tonic) tuples ranked best first."""
    candidates: list[tuple[int, bool, int]] = []
    for minor in (False, True):
        fits = MINOR_DEGREE_FITS if minor else MAJOR_DEGREE_FITS
        for tonic in range(12):
            score = 0
            for semitone, quality, weight in observations:
                degree_fits = fits.get((semitone - tonic) % 12)
                fit = degree_fits[quality] if degree_fits else OUT_OF_SCALE_FIT
                score += weight * fit
            candidates.append((score, minor, tonic))
    candidates.sort(key=lambda candidate: (-candidate[0], candidate[1], candidate[2]))
    return candidates


def _spell_detected_key(semitone: int, minor: bool, german: bool) -> str:
    """Spell a detected key with the conventional accidental for its signature."""
    flat_label = key_label(FLAT_SPELLING[semitone], minor)
    sharp_label = key_label(SHARP_SPELLING[semitone], minor)
    if flat_label in FLAT_KEYS:
        use_flats = True
    elif sharp_label in SHARP_KEYS:
        use_flats = False
    else:
        use_flats = True
    return key_label(choose_spelling(use_flats, german)[semitone], minor)


class KeyDetection(TypedDict):
    """Result of guessing a sheet's key from its chords."""

    key: str | None
    alternate: str | None
    ambiguous: bool
    chords: int
    distinct: int
    german: bool


def detect_key(text: str) -> KeyDetection:
    """Guess the key of a chord sheet from its chords.

    Returns a dict with ``key`` (label or None), ``alternate`` (runner-up label
    when the result is ambiguous), ``ambiguous``, ``chords`` (total chord
    tokens), ``distinct`` (distinct chord roots), and ``german`` (whether the
    sheet is written in German notation). ``key`` is None when the sheet has
    too few chords to tell, but ``german`` is always reported so callers can
    label their key pickers even when the guess fails.
    """
    observations, german, total, distinct = _detect_observations(text)
    result: KeyDetection = {
        "key": None,
        "alternate": None,
        "ambiguous": False,
        "chords": total,
        "distinct": distinct,
        "german": german,
    }
    if total < DETECT_MIN_CHORDS or distinct < DETECT_MIN_DISTINCT_ROOTS:
        return result

    ranked = _score_key_candidates(observations)
    best_score, best_minor, best_tonic = ranked[0]
    second_score, second_minor, second_tonic = ranked[1]
    result["key"] = _spell_detected_key(best_tonic, best_minor, german)
    result["ambiguous"] = (best_score - second_score) * 100 < DETECT_AMBIGUITY_PERCENT * best_score
    if result["ambiguous"]:
        result["alternate"] = _spell_detected_key(second_tonic, second_minor, german)
    return result


def detect_key_from_docx_bytes(file_bytes: bytes) -> KeyDetection:
    """Guess the key of a .docx chord sheet given as bytes (see ``detect_key``)."""
    document = Document(BytesIO(file_bytes))
    text = "\n".join(paragraph.text for paragraph in iter_paragraphs(document))
    return detect_key(text)


def note_to_nashville_degree(note: str, tonic_semitone: int, german: bool) -> str:
    """Return the Nashville scale-degree string (e.g. '1', '4', 'b7') for a note."""
    degree = (note_semitone(note, german) - tonic_semitone) % 12
    if degree in MAJOR_SCALE_DEGREES:
        return MAJOR_SCALE_DEGREES[degree]
    return CHROMATIC_DEGREE_NAMES[degree]


def chord_to_nashville(chord: str, tonic_semitone: int, german: bool) -> str:
    """Convert a chord symbol to its Nashville number, preserving quality and bass."""
    return map_chord_roots(
        chord, lambda root: note_to_nashville_degree(root, tonic_semitone, german)
    )


def _nashville_line(line: str, tonic_semitone: int, german: bool) -> str:
    """Convert every chord token in a chord line to Nashville numbers."""
    leading = line[: len(line) - len(line.lstrip())]
    result = leading
    for token_match in TOKEN_SPLIT_RE.finditer(line[len(leading) :]):
        token = token_match.group(1)
        trailing = token_match.group(2)
        if is_chord_token(token):
            token = chord_to_nashville(token, tonic_semitone, german)
        result += token + trailing
    return result


def _nashville_chordpro_line(line: str, tonic_semitone: int, german: bool) -> str:
    """Convert bracketed ChordPro chord tokens to Nashville numbers."""

    def replace(match: re.Match[str]) -> str:
        token = match.group(1)
        if not CHORD_TOKEN_RE.match(token.strip()):
            return match.group(0)
        return f"[{chord_to_nashville(token, tonic_semitone, german)}]"

    return CHORDPRO_BRACKET_RE.sub(replace, line)


def text_to_nashville(text: str, tonic_key: str, german: bool | None = None) -> tuple[str, str]:
    """Convert chord lines (or ChordPro brackets) in text to Nashville numbers.

    Returns ``(result_text, tonic_label)``. Lyric lines are left unchanged.
    """
    tonic = parse_key(tonic_key)
    if tonic is None:
        raise InvalidKeyError(f"'{tonic_key}' is not a valid key.")
    tonic_note, tonic_minor = tonic

    chordpro = is_chordpro_text(text)
    if german is None:
        german = _chordpro_uses_german(text) if chordpro else _text_uses_german(text)
    tonic_semitone = key_semitone(tonic_note, german)

    result_parts = []
    for segment in text.splitlines(keepends=True):
        content = segment.splitlines()[0] if segment.splitlines() else ""
        ending = segment[len(content) :]
        if chordpro:
            content = _nashville_chordpro_line(content, tonic_semitone, german)
        elif is_chord_line(content):
            content = _nashville_line(content, tonic_semitone, german)
        result_parts.append(content + ending)

    return "".join(result_parts), key_label(tonic_note, tonic_minor)


def transpose_document_bytes(
    file_bytes: bytes,
    current_key: str,
    target_key: str,
    edits: ParagraphEdits | None = None,
    german: bool | None = None,
) -> tuple[bytes, str, str, list[tuple[str, str]]]:
    """Transpose a .docx given as bytes and return (docx_bytes, from_label, to_label, changes).

    ``edits`` maps a paragraph's original text to the text it should end up with
    after transposition, carrying the user's corrections from the preview.
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
        (paragraph, edits[paragraph.text])
        for paragraph in iter_body_paragraphs(document)
        if edits and paragraph.text in edits
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


if __name__ == "__main__":
    main()
