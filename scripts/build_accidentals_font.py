"""Build the accidentals font from Noto Music.

The bundled text fonts have no flat, natural or sharp glyphs, so key names such
as F♯ and B♭m would fall back to whatever symbol font each platform ships. This
script cuts those three glyphs out of Noto Music, lifts them so they sit on the
text baseline next to a capital letter, and writes a tiny WOFF2 that the
stylesheet layers first in the sans and serif families via ``unicode-range``.
The monospace stack leaves it out: its narrow glyphs would break the fixed
character grid that keeps chords above their lyrics.

Run it from the project environment (fontTools is a dev dependency):

    uv run python scripts/build_accidentals_font.py \
        NotoMusic-Regular.ttf src/static/fonts/accidentals-noto-music-2.004.woff2
"""

import sys
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

FLAT = 0x266D
NATURAL = 0x266E
SHARP = 0x266F

CAP_HEIGHT_CENTRE = 360
SIDE_BEARING = 40


def lift_onto_baseline(font: TTFont, codepoint: int, scale: float) -> None:
    cmap = font.getBestCmap()
    if cmap is None:
        raise ValueError("The source font has no Unicode character map.")
    glyph_name = cmap[codepoint]
    glyph_set = font.getGlyphSet()
    recording = DecomposingRecordingPen(glyph_set)
    glyph_set[glyph_name].draw(recording)

    glyph = font["glyf"][glyph_name]
    glyph.recalcBounds(font["glyf"])
    centre = (glyph.yMin + glyph.yMax) / 2
    shift_x = SIDE_BEARING - glyph.xMin * scale
    shift_y = CAP_HEIGHT_CENTRE - centre * scale

    pen = TTGlyphPen(None)
    recording.replay(TransformPen(pen, (scale, 0, 0, scale, shift_x, shift_y)))
    lifted = pen.glyph()
    font["glyf"][glyph_name] = lifted
    lifted.recalcBounds(font["glyf"])

    width = round((glyph.xMax - glyph.xMin) * scale) + 2 * SIDE_BEARING
    font["hmtx"][glyph_name] = (width, SIDE_BEARING)


def build(source: Path, target: Path) -> None:
    font = TTFont(source, recalcTimestamp=False)
    options = Options()
    options.layout_features = []
    options.hinting = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=[FLAT, NATURAL, SHARP])
    subsetter.subset(font)

    lift_onto_baseline(font, FLAT, scale=1.05)
    lift_onto_baseline(font, NATURAL, scale=1.0)
    lift_onto_baseline(font, SHARP, scale=1.0)

    font.flavor = "woff2"
    font.save(target)


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]))
