"""Guessing a chord sheet's key from the chords it uses."""

from collections.abc import Sequence
from typing import TypedDict

from .chordpro import CHORDPRO_BRACKET_RE, _chordpro_uses_german, is_chordpro_text
from .chords import CHORD_TOKEN_RE, is_chord_line, parse_chord_core, split_affixes
from .notation import (
    FLAT_KEYS,
    FLAT_SPELLING,
    SHARP_KEYS,
    SHARP_SPELLING,
    choose_spelling,
    key_label,
    note_semitone,
)
from .text import _text_uses_german

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
