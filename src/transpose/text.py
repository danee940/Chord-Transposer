"""Transposition of plain-text chord sheets."""

from collections.abc import Sequence

from .chords import TOKEN_SPLIT_RE, is_chord_line, is_chord_token, line_uses_german, transpose_chord
from .errors import InvalidKeyError
from .notation import choose_spelling, key_label, key_semitone, key_spelling, parse_key


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
