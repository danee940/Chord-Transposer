"""Data and structured-content helpers for the server-rendered SEO landing pages.

This module is the single source of truth for the FAQ, the how-to steps, the
instrument pages, and the chromatic transposition chart. Both the Flask routes
and the templates read their content from here so the visible copy and the
JSON-LD structured data cannot drift apart.

Each page carries a ``lastmod`` date that is published in ``/sitemap.xml``. Bump
the date of a page whenever you change the copy it renders, and leave the others
alone, so crawlers keep treating the dates as trustworthy.
"""

from collections.abc import Iterable
from typing import Any, NotRequired, TypedDict

from transpose import SHARP_SPELLING


class FaqItem(TypedDict):
    """A single question/answer pair rendered in a page's FAQ section."""

    question: str
    answer: str


class HowToStep(TypedDict):
    """A single step of the home page's how-to list."""

    text: str


class Breadcrumb(TypedDict):
    """One crumb of a landing page's breadcrumb trail."""

    name: str
    url: str


class ChartRow(TypedDict):
    """One row of a chromatic transposition chart."""

    note: str
    cells: list[str]


class ChromaticChart(TypedDict):
    """A chromatic transposition chart with its headers and rows."""

    shifts: list[int]
    headers: list[str]
    rows: list[ChartRow]


class IntervalRow(TypedDict):
    """One row of the semitone-to-interval reference table."""

    semitones: int
    name: str
    example: str


class KeySignatureRow(TypedDict):
    """One row of the circle-of-fifths key-signature reference table."""

    key: str
    accidentals: str
    relative_minor: str


class Instrument(TypedDict):
    """The source record describing an instrument landing page."""

    instrument: str
    slug: str
    lastmod: str
    name: str
    title: str
    description: str
    h1: str
    preselect_from: str
    preselect_to: str
    preselect_instrument: str
    faq_items: list[FaqItem]
    show_capo: bool
    intro_paragraphs: list[str]
    features: list[str]


class LandingPage(TypedDict):
    """The full page record a landing page is rendered from."""

    id: str
    path: str
    kind: str
    lastmod: str
    title: str
    description: str
    h1: str
    intro_paragraphs: list[str]
    canonical: str
    preselect_from: str
    preselect_to: str
    faq_items: list[FaqItem]
    show_capo: bool
    breadcrumbs: list[Breadcrumb]
    jsonld: list[dict[str, Any]]
    instrument: NotRequired[str]
    preselect_instrument: NotRequired[str]
    features: NotRequired[list[str]]
    chart: NotRequired[ChromaticChart]
    interval_reference: NotRequired[list[IntervalRow]]
    key_signature_reference: NotRequired[list[KeySignatureRow]]


class NavLink(TypedDict):
    """A single internal link offered in the cross-link hub or 404 page."""

    name: str
    path: str


class NavSection(TypedDict):
    """A heading with its group of internal links in the cross-link hub."""

    heading: str
    links: list[NavLink]


class SitemapEntry(TypedDict):
    """An indexable path paired with the date its content last changed."""

    path: str
    lastmod: str


SITE_URL = "https://chordtransposer.app"

KEY_PAIR_SLUG_SEPARATOR = "-to-"

HOME_LAST_MODIFIED = "2026-10-24"

FAQ_ITEMS: list[FaqItem] = [
    {
        "question": "How do I transpose chords to a different key?",
        "answer": (
            "Paste your chords, choose the key the song is currently in, and pick the key you "
            "want it in. The transposed chords appear instantly, with no upload needed. Every "
            "chord is shifted by the same interval so the song sounds identical, just higher or "
            "lower."
        ),
    },
    {
        "question": "Can I transpose chords without uploading a file?",
        "answer": (
            "Yes. Use the paste-chords mode to type or paste chords directly and see the "
            "transposed result instantly in your browser. Uploading a .docx file is optional and "
            "only needed when you want to download a transposed Word or PDF document."
        ),
    },
    {
        "question": "Does transposing keep my document formatting?",
        "answer": (
            "Yes. Only the chord names are changed. Fonts, spacing, colours, tables, and the "
            "overall layout of your .docx are preserved."
        ),
    },
    {
        "question": "Which chords and keys are supported?",
        "answer": (
            "All twelve major and twelve minor keys are supported, including sharp and flat "
            "spellings such as C#, Db, F#m, and Bbm. Slash chords, sus, add, maj7, and other "
            "chord qualities are recognised and transposed correctly."
        ),
    },
    {
        "question": "Do you support German H notation?",
        "answer": (
            "Yes. German notation where H means B and B means B-flat is detected and transposed "
            "correctly, so sheets written in either the English or German system work."
        ),
    },
    {
        "question": "Is the chord transposer free?",
        "answer": (
            "Yes, it is completely free with no sign-up. You can transpose as many chord sheets "
            "as you like."
        ),
    },
    {
        "question": "Can I download the result as a PDF?",
        "answer": (
            "Yes. Choose the PDF output option before transposing to get a ready-to-print PDF, "
            "or keep the editable .docx version."
        ),
    },
    {
        "question": "Are my files stored anywhere?",
        "answer": (
            "No. Your chord sheet is processed to generate the transposed file and is not kept "
            "after the download is returned."
        ),
    },
]

GUITAR_FAQ_ITEMS: list[FaqItem] = [
    {
        "question": "How do I transpose guitar chords to a new key?",
        "answer": (
            "Paste your guitar chords, choose the key the song is in, and pick the key you want "
            "to play in. Every chord shifts by the same interval so the song sounds the same, "
            "just higher or lower — no upload needed."
        ),
    },
    {
        "question": "How does the capo finder work?",
        "answer": (
            "Tell the capo finder the key you want to hear and it shows which fret to clamp so "
            "you can keep playing familiar open-chord shapes like C, G, D, A, E, and their "
            "relative minors while sounding in the key you chose."
        ),
    },
    {
        "question": "Does it handle slash chords and barre chords?",
        "answer": (
            "Yes. Slash chords such as G/B are transposed correctly, and moving to a "
            "guitar-friendly key often lets you swap awkward barre chords for easier open shapes."
        ),
    },
    {
        "question": "Which keys are easiest to play on guitar?",
        "answer": (
            "Open keys like G, C, D, A, and E sit best under the fingers. Transpose into one of "
            "those, or use the capo finder, to turn a tricky chart into open shapes."
        ),
    },
    {
        "question": "Is the guitar chord transposer free?",
        "answer": (
            "Yes, it is completely free with no sign-up, and you can transpose as many songs as "
            "you like."
        ),
    },
]

UKULELE_FAQ_ITEMS: list[FaqItem] = [
    {
        "question": "How do I transpose ukulele chords to a new key?",
        "answer": (
            "Paste your ukulele chords, set the current key, and pick the target key. The whole "
            "sheet shifts by the same interval so the melody is unchanged and you keep the same "
            "chord shapes, just moved to a new key."
        ),
    },
    {
        "question": "Which keys are best for ukulele?",
        "answer": (
            "Ukulele-friendly keys like C, F, G, and A sit comfortably under the fingers. "
            "Transposing into one of those turns a hard chart into open, singable shapes."
        ),
    },
    {
        "question": "Will transposing change the chord shapes I know?",
        "answer": (
            "Transposing moves every chord by the same interval, so the shapes shift together. "
            "Choosing a ukulele-friendly target key keeps the shapes easy to play."
        ),
    },
    {
        "question": "Does it keep chord qualities like sus and 7th chords?",
        "answer": (
            "Yes. Chord qualities from simple triads to sus, add, and 7th chords are recognised "
            "and transposed correctly."
        ),
    },
    {
        "question": "Is the ukulele chord transposer free?",
        "answer": (
            "Yes, it is completely free with no sign-up, and there is nothing to install — it "
            "runs instantly in your browser."
        ),
    },
]

PIANO_FAQ_ITEMS: list[FaqItem] = [
    {
        "question": "How do I transpose piano chords to a new key?",
        "answer": (
            "Paste your piano chords, pick the current and target keys, and every chord is "
            "rewritten in the new key with the sharps or flats that read naturally there."
        ),
    },
    {
        "question": "Will it choose the right sharp or flat spelling?",
        "answer": (
            "Yes. The tool spells each transposed chord with the sharps or flats that match the "
            "target key, so the result reads correctly on the page."
        ),
    },
    {
        "question": "Why is there no capo option for piano?",
        "answer": (
            "A capo only exists on fretted instruments. On a keyboard the way to make a song "
            "easier is to choose a written key that lies more comfortably under the hands."
        ),
    },
    {
        "question": "Does it handle extended and slash chords?",
        "answer": (
            "Yes. Extended chords, slash chords, and inversions are all recognised and moved "
            "correctly to the new key."
        ),
    },
    {
        "question": "Is the piano chord transposer free?",
        "answer": (
            "Yes, it is completely free with no sign-up, and you can transpose as many charts as "
            "you like."
        ),
    },
]

FILE_FAQ_ITEMS: list[FaqItem] = [
    {
        "question": "Which file types can I upload?",
        "answer": (
            "You can upload Word (.docx), plain text (.txt), and ChordPro (.pro and .cho) chord "
            "sheets. Drop several .docx files at once to build a single combined PDF binder."
        ),
    },
    {
        "question": "Does uploading keep my document formatting?",
        "answer": (
            "Yes. For .docx files only the chord names change — fonts, spacing, colours, tables, "
            "and the overall layout are preserved in the downloaded file."
        ),
    },
    {
        "question": "Can I download the result as a PDF?",
        "answer": (
            "Yes. Choose the PDF output option before transposing to get a ready-to-print PDF, "
            "or keep the editable file in its original format."
        ),
    },
    {
        "question": "Are my uploaded files stored anywhere?",
        "answer": (
            "No. Your chord sheet is processed to generate the transposed file and is not kept "
            "after the download is returned."
        ),
    },
    {
        "question": "Do I have to upload a file to transpose chords?",
        "answer": (
            "No. Uploading is only for downloading a transposed document. To transpose on screen, "
            "paste your chords into the instant transposer instead."
        ),
    },
]

CHART_FAQ_ITEMS: list[FaqItem] = [
    {
        "question": "How do I use a chromatic transposition chart?",
        "answer": (
            "Find the row for the note you have, then read across to the column for the number "
            "of semitones you want to move up, and the cell shows the note it becomes."
        ),
    },
    {
        "question": "How many semitones should I move?",
        "answer": (
            "Count the interval between your current and target keys. The same shift applies to "
            "every chord in the song, so you can convert a whole sheet one chord at a time."
        ),
    },
    {
        "question": "Do I have to transpose by hand?",
        "answer": (
            "No. The chart is a handy reference, but you can paste your chords into the "
            "transposer above to shift a whole sheet instantly."
        ),
    },
    {
        "question": "Does the chart cover sharp and flat keys?",
        "answer": (
            "The chart uses sharp spellings, and the interactive transposer chooses the correct "
            "sharp or flat spelling for whichever target key you pick."
        ),
    },
]

HOWTO_STEPS: list[HowToStep] = [
    {"text": "Paste your chords, or upload a chord sheet in .docx format."},
    {"text": "Select the key the song is currently written in."},
    {"text": "Select the key you want to play it in."},
    {"text": "See the result instantly, or download it as a .docx or PDF."},
]

WEBAPP_JSONLD: dict[str, Any] = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Chord Transposer",
    "url": f"{SITE_URL}/",
    "description": (
        "Free online tool to transpose chords between musical keys. Paste chords for an "
        "instant preview, or upload a .docx chord sheet to download it transposed with "
        "formatting preserved."
    ),
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Any",
    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
}

INSTRUMENTS: list[Instrument] = [
    {
        "instrument": "guitar",
        "slug": "guitar-chord-transposer",
        "lastmod": "2026-10-24",
        "name": "Guitar",
        "title": "Guitar Chord Transposer — Change Key & Capo Finder",
        "description": (
            "Transpose guitar chords to any key online and find the capo position that keeps "
            "familiar open-chord shapes. Free, instant, and formatting-preserving for .docx "
            "chord sheets."
        ),
        "h1": "Guitar chord transposer",
        "preselect_from": "C",
        "preselect_to": "G",
        "preselect_instrument": "guitar",
        "faq_items": GUITAR_FAQ_ITEMS,
        "show_capo": True,
        "intro_paragraphs": [
            "Change the key of any guitar song and keep playing the shapes you already know. "
            "Paste your chords, choose the current and target keys, and every chord moves by the "
            "same interval so the song sounds identical, just higher or lower.",
            "Guitarists often transpose to fit a singer's range or to swap awkward barre chords "
            "for open positions. Pair the transposer with the capo finder below to see which "
            "fret lets you play easy open shapes while sounding in the key you want.",
        ],
        "features": [
            "Recognises slash chords like G/B, plus sus, add, and maj7 qualities.",
            "Works with both sharp and flat spellings such as F# and Db.",
            "Capo finder maps your target key to open-chord shapes.",
        ],
    },
    {
        "instrument": "ukulele",
        "slug": "ukulele-chord-transposer",
        "lastmod": "2026-10-24",
        "name": "Ukulele",
        "title": "Ukulele Chord Transposer — Change Chords to Any Key",
        "description": (
            "Transpose ukulele chords to any key instantly. Move a song up or down to suit your "
            "voice while keeping the same easy shapes. Free and no sign-up."
        ),
        "h1": "Ukulele chord transposer",
        "preselect_from": "C",
        "preselect_to": "G",
        "preselect_instrument": "ukulele",
        "faq_items": UKULELE_FAQ_ITEMS,
        "show_capo": False,
        "intro_paragraphs": [
            "Transpose ukulele songs to a more comfortable key in seconds. Paste your chords, "
            "set the current and target keys, and see the whole sheet shift by the same interval "
            "so the melody is unchanged.",
            "Ukulele players lean on friendly keys like C, F, G, and A that sit well under the "
            "fingers. Transposing into one of those keys turns a tricky chart into open, "
            "singable shapes without changing how the song feels.",
        ],
        "features": [
            "Great for moving songs into ukulele-friendly keys such as C, F, and G.",
            "Keeps chord qualities intact, from simple triads to sus and 7th chords.",
            "Instant preview in the browser — nothing to install.",
        ],
    },
    {
        "instrument": "piano",
        "slug": "piano-chord-transposer",
        "lastmod": "2026-10-24",
        "name": "Piano",
        "title": "Piano Chord Transposer — Transpose Chords to Any Key",
        "description": (
            "Transpose piano and keyboard chords to any key online. Get correct sharp or flat "
            "spellings for the target key instantly, with no sign-up."
        ),
        "h1": "Piano chord transposer",
        "preselect_from": "C",
        "preselect_to": "D",
        "preselect_instrument": "piano",
        "faq_items": PIANO_FAQ_ITEMS,
        "show_capo": False,
        "intro_paragraphs": [
            "Move a piano chart to any key and let the tool handle the spelling. Paste your "
            "chords, pick the current and target keys, and each chord is rewritten with the "
            "sharps or flats that read naturally in the new key.",
            "Pianists transpose to match a vocalist or to trade a key full of black notes for "
            "one that lies more comfortably under the hands. Because there is no capo on a "
            "keyboard, choosing the right written key is what makes a song easier to play.",
        ],
        "features": [
            "Chooses sharp or flat spelling to match the target key.",
            "Handles extended chords, slash chords, and inversions.",
            "Download transposed .docx or PDF chord sheets with layout preserved.",
        ],
    },
]

COMPACT_CHART_SHIFTS = [2, 5, 7]

_SHIFT_LABELS = {
    2: "+2 (whole step)",
    5: "+5 (fourth)",
    7: "+7 (fifth)",
}


def key_slug(key: str) -> str:
    """Return the lowercase URL fragment a key had in the retired key-pair pages."""
    return key.replace("#", "-sharp").lower()


def key_pair_from_slug(slug: str, keys: Iterable[str]) -> tuple[str, str] | None:
    """Return the (current, target) keys a retired key-pair slug named, or None."""
    parts = slug.split(KEY_PAIR_SLUG_SEPARATOR)
    if len(parts) != 2:
        return None
    lookup = {key_slug(key): key for key in keys}
    from_key = lookup.get(parts[0])
    to_key = lookup.get(parts[1])
    if from_key is None or to_key is None:
        return None
    return from_key, to_key


def _breadcrumbs(title: str, path: str) -> list[Breadcrumb]:
    """Return the breadcrumb trail from the home page to the given landing page."""
    return [
        {"name": "Home", "url": f"{SITE_URL}/"},
        {"name": title, "url": f"{SITE_URL}{path}"},
    ]


def _breadcrumb_jsonld(breadcrumbs: list[Breadcrumb]) -> dict[str, Any]:
    """Return a BreadcrumbList structured-data block for a landing page."""
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "name": crumb["name"],
                "item": crumb["url"],
            }
            for index, crumb in enumerate(breadcrumbs, start=1)
        ],
    }


def home_jsonld() -> list[dict[str, Any]]:
    """Return the structured-data blocks for the home page."""
    return [WEBAPP_JSONLD]


def _instrument_page(instrument: Instrument) -> LandingPage:
    """Build the full page record for an instrument landing page."""
    path = f"/{instrument['slug']}"
    breadcrumbs = _breadcrumbs(instrument["name"], path)
    return {
        "id": instrument["slug"].replace("-", "_"),
        "path": path,
        "kind": "instrument",
        "lastmod": instrument["lastmod"],
        "instrument": instrument["instrument"],
        "title": instrument["title"],
        "description": instrument["description"],
        "h1": instrument["h1"],
        "intro_paragraphs": instrument["intro_paragraphs"],
        "features": instrument["features"],
        "canonical": f"{SITE_URL}{path}",
        "preselect_from": instrument["preselect_from"],
        "preselect_to": instrument["preselect_to"],
        "preselect_instrument": instrument["preselect_instrument"],
        "faq_items": instrument["faq_items"],
        "show_capo": instrument["show_capo"],
        "breadcrumbs": breadcrumbs,
        "jsonld": [_breadcrumb_jsonld(breadcrumbs)],
    }


def _chart_rows(shifts: list[int]) -> list[ChartRow]:
    """Return chromatic chart rows mapping each note to its shifted spelling."""
    rows: list[ChartRow] = []
    for index, note in enumerate(SHARP_SPELLING):
        cells = [SHARP_SPELLING[(index + shift) % 12] for shift in shifts]
        rows.append({"note": note, "cells": cells})
    return rows


def chromatic_chart(shifts: list[int]) -> ChromaticChart:
    """Return a chromatic transposition chart for the given semitone shifts."""
    headers = [_SHIFT_LABELS.get(shift, f"+{shift}") for shift in shifts]
    return {"shifts": shifts, "headers": headers, "rows": _chart_rows(shifts)}


def compact_chromatic_chart() -> ChromaticChart:
    """Return the small chromatic chart embedded on the home page."""
    return chromatic_chart(COMPACT_CHART_SHIFTS)


_INTERVAL_QUALITIES = {
    0: "Perfect unison",
    1: "Minor second",
    2: "Major second",
    3: "Minor third",
    4: "Major third",
    5: "Perfect fourth",
    6: "Tritone",
    7: "Perfect fifth",
    8: "Minor sixth",
    9: "Major sixth",
    10: "Minor seventh",
    11: "Major seventh",
    12: "Perfect octave",
}

_INTERVAL_EXAMPLES = {
    0: "C to C",
    1: "C to C#",
    2: "C to D",
    3: "C to Eb",
    4: "C to E",
    5: "C to F",
    6: "C to F#",
    7: "C to G",
    8: "C to Ab",
    9: "C to A",
    10: "C to Bb",
    11: "C to B",
    12: "C to C",
}


def interval_reference() -> list[IntervalRow]:
    """Return the semitone-to-interval reference rows for the chart page."""
    return [
        {
            "semitones": semitones,
            "name": _INTERVAL_QUALITIES[semitones],
            "example": _INTERVAL_EXAMPLES[semitones],
        }
        for semitones in range(13)
    ]


_KEY_SIGNATURES: list[KeySignatureRow] = [
    {"key": "C", "accidentals": "none", "relative_minor": "Am"},
    {"key": "G", "accidentals": "1 sharp", "relative_minor": "Em"},
    {"key": "D", "accidentals": "2 sharps", "relative_minor": "Bm"},
    {"key": "A", "accidentals": "3 sharps", "relative_minor": "F#m"},
    {"key": "E", "accidentals": "4 sharps", "relative_minor": "C#m"},
    {"key": "B", "accidentals": "5 sharps", "relative_minor": "G#m"},
    {"key": "F#", "accidentals": "6 sharps", "relative_minor": "D#m"},
    {"key": "Db", "accidentals": "5 flats", "relative_minor": "Bbm"},
    {"key": "Ab", "accidentals": "4 flats", "relative_minor": "Fm"},
    {"key": "Eb", "accidentals": "3 flats", "relative_minor": "Cm"},
    {"key": "Bb", "accidentals": "2 flats", "relative_minor": "Gm"},
    {"key": "F", "accidentals": "1 flat", "relative_minor": "Dm"},
]


def key_signature_reference() -> list[KeySignatureRow]:
    """Return the circle-of-fifths key-signature reference rows for the chart page."""
    return list(_KEY_SIGNATURES)


def _chart_page() -> LandingPage:
    """Build the full page record for the chromatic transposition chart page."""
    path = "/chromatic-chart"
    breadcrumbs = _breadcrumbs("Chromatic chart", path)
    return {
        "id": "chromatic_chart",
        "path": path,
        "kind": "chart",
        "lastmod": "2026-10-24",
        "title": "Chromatic Transposition Chart — Every Key by Semitone",
        "description": (
            "A chromatic transposition chart showing where each note lands when you shift it up "
            "by one to eleven semitones. Free reference for transposing chords to any key."
        ),
        "h1": "Chromatic transposition chart",
        "intro_paragraphs": [
            "Use this chart to transpose any chord by ear or on paper. Find the row for the note "
            "you have, then read across to the column for the number of semitones you want to "
            "move, and the cell shows the note it becomes.",
            "Every shift applies to all twelve notes equally, so once you know the interval "
            "between your current and target keys you can convert a whole chord sheet a chord at "
            "a time — or paste it into the transposer below to do it instantly.",
        ],
        "canonical": f"{SITE_URL}{path}",
        "preselect_from": "C",
        "preselect_to": "D",
        "faq_items": CHART_FAQ_ITEMS,
        "show_capo": False,
        "chart": chromatic_chart(list(range(1, 12))),
        "interval_reference": interval_reference(),
        "key_signature_reference": key_signature_reference(),
        "breadcrumbs": breadcrumbs,
        "jsonld": [_breadcrumb_jsonld(breadcrumbs)],
    }


def _file_page() -> LandingPage:
    """Build the full page record for the file upload transposer page."""
    path = "/file-chord-transposer"
    breadcrumbs = _breadcrumbs("File transposer", path)
    return {
        "id": "file_chord_transposer",
        "path": path,
        "kind": "file",
        "lastmod": "2026-10-24",
        "title": "File Chord Transposer — Transpose .docx, .txt & ChordPro",
        "description": (
            "Upload a chord sheet file and download it transposed to any key. Supports Word "
            "(.docx), plain text (.txt), and ChordPro (.pro/.cho), with formatting preserved and "
            "PDF output. Free, no sign-up."
        ),
        "h1": "File chord transposer",
        "intro_paragraphs": [
            "Transpose a whole chord sheet file at once and download the result. Upload a Word "
            ".docx, a plain-text .txt, or a ChordPro .pro/.cho file, choose the current and "
            "target keys, and every chord moves by the same interval so the song is unchanged.",
            "For .docx files the layout is kept intact — only the chord names change — so you "
            "get a clean copy ready to print or share. You can also drop several .docx files to "
            "build one combined PDF binder, or export any upload as a PDF.",
        ],
        "canonical": f"{SITE_URL}{path}",
        "preselect_from": "C",
        "preselect_to": "D",
        "faq_items": FILE_FAQ_ITEMS,
        "show_capo": False,
        "breadcrumbs": breadcrumbs,
        "jsonld": [_breadcrumb_jsonld(breadcrumbs)],
    }


def landing_pages() -> list[LandingPage]:
    """Return every indexable landing page record in navigation order."""
    pages = [_instrument_page(instrument) for instrument in INSTRUMENTS]
    pages.append(_file_page())
    pages.append(_chart_page())
    return pages


NOT_FOUND_LINK_IDS = ("guitar_chord_transposer", "file_chord_transposer", "chromatic_chart")


def not_found_links() -> list[NavLink]:
    """Return the landing pages offered as shortcut buttons on the 404 page."""
    pages_by_id = {page["id"]: page for page in landing_pages()}
    return [
        {"name": pages_by_id[page_id]["h1"], "path": pages_by_id[page_id]["path"]}
        for page_id in NOT_FOUND_LINK_IDS
    ]


def nav_sections() -> list[NavSection]:
    """Return grouped internal links for the cross-link hub in nav and footer."""
    instrument_links: list[NavLink] = [
        {"name": f"{instrument['name']} transposer", "path": f"/{instrument['slug']}"}
        for instrument in INSTRUMENTS
    ]
    file_links: list[NavLink] = [{"name": "File transposer", "path": "/file-chord-transposer"}]
    reference_links: list[NavLink] = [{"name": "Chromatic chart", "path": "/chromatic-chart"}]
    return [
        {"heading": "Upload files", "links": file_links},
        {"heading": "By instrument", "links": instrument_links},
        {"heading": "Reference", "links": reference_links},
    ]


def nav_columns() -> list[list[NavSection]]:
    """Split the nav sections into two balanced columns for the cross-link hub."""
    columns: list[list[NavSection]] = [[], []]
    counts = [0, 0]
    for section in nav_sections():
        target = 0 if counts[0] <= counts[1] else 1
        columns[target].append(section)
        counts[target] += len(section["links"])
    return columns


def sitemap_entries() -> list[SitemapEntry]:
    """Return every indexable path with the date its content last changed."""
    entries: list[SitemapEntry] = [{"path": "/", "lastmod": HOME_LAST_MODIFIED}]
    entries.extend({"path": page["path"], "lastmod": page["lastmod"]} for page in landing_pages())
    return entries


def sitemap_paths() -> list[str]:
    """Return every indexable path, starting with the home page."""
    return [entry["path"] for entry in sitemap_entries()]
