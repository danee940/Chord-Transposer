"""Chord symbol grammar: parsing, rewriting, and chord-line detection."""

import re
from collections.abc import Callable, Iterator, Sequence
from typing import NamedTuple

from .notation import GERMAN_NOTE_NAMES, transpose_note

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
