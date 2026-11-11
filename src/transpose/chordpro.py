"""Transposition of ChordPro sheets with inline bracketed chords."""

import re
from collections.abc import Sequence

from .chords import CHORD_TOKEN_RE, line_uses_german, transpose_chord
from .errors import InvalidKeyError
from .notation import choose_spelling, key_label, key_semitone, key_spelling, parse_key

CHORDPRO_BRACKET_RE = re.compile(r"\[([^\]]+)\]")


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
