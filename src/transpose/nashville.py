"""Conversion of chord sheets to Nashville number notation."""

import re

from .chordpro import CHORDPRO_BRACKET_RE, _chordpro_uses_german, is_chordpro_text
from .chords import CHORD_TOKEN_RE, TOKEN_SPLIT_RE, is_chord_line, is_chord_token, map_chord_roots
from .errors import InvalidKeyError
from .notation import key_label, key_semitone, note_semitone, parse_key
from .text import _text_uses_german

MAJOR_SCALE_DEGREES = {0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7"}
CHROMATIC_DEGREE_NAMES = {1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7"}


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
