"""Note names, key parsing, and key-aware chromatic spelling."""

from collections.abc import Sequence

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
