# Bundled fonts

All fonts are licensed under the SIL Open Font License 1.1; each license sits
next to the files it covers. File names carry the upstream version because
everything under `/static/` is served with an immutable cache header: ship a
new version under a new name.

| File | Source |
| --- | --- |
| `ibm-plex-sans-latin-wght-5.3.0.woff2` | `@fontsource-variable/ibm-plex-sans` 5.3.0, `files/ibm-plex-sans-latin-wght-normal.woff2` |
| `ibm-plex-mono-latin-400-5.3.0.woff2` | `@fontsource/ibm-plex-mono` 5.3.0, `files/ibm-plex-mono-latin-400-normal.woff2` |
| `ibm-plex-mono-latin-600-5.3.0.woff2` | `@fontsource/ibm-plex-mono` 5.3.0, `files/ibm-plex-mono-latin-600-normal.woff2` |
| `source-serif-4-latin-600-5.3.1.woff2` | `@fontsource/source-serif-4` 5.3.1, `files/source-serif-4-latin-600-normal.woff2` |
| `accidentals-noto-music-2.004.woff2` | Noto Music 2.004 (`google/fonts`, `ofl/notomusic/NotoMusic-Regular.ttf`), built with `scripts/build_accidentals_font.py` |

The Latin subsets have no ♭ ♮ ♯ glyphs, so the accidentals font is layered
first in the sans and serif families with `unicode-range: U+266D-266F` (the
monospace stack leaves it out to keep its fixed character grid; see
`src/styles/tailwind.input.css`).
