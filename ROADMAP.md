# Roadmap

Planned work for Chord Transposer, live at [chordtransposer.app](https://chordtransposer.app/).
Items are grouped by theme and roughly ordered by priority within each group.
Sizes are rough estimates: **S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ 3+ days.

## Transposition engine

- [ ] **Automatic key detection (M)**: guess the current key from the chords in
      a pasted text or uploaded file and preselect it, instead of making the user
      pick it. Implement in both `src/transpose.py` and `src/js/transpose/`, with
      shared cases in `src/testdata/transpose_cases.json`.
- [ ] **Key-aware enharmonic spelling (M)**: spell chords correctly for the
      target key (for example `F#` vs `Gb`, `Cb` in `Gb` major) rather than
      choosing between two fixed sharp and flat spellings.
- [ ] **Broader chord grammar (S)**: support more chord symbols such as `6/9`,
      `7♭9`, `alt`, `Δ` and Unicode `♯`/`♭`. Add parity cases for each.
- [ ] **Docx coverage gaps (M)**: transpose chords inside text boxes, shapes,
      footnotes, and first-page and even-page headers and footers.

## Input and output formats

- [ ] **OpenDocument (.odt) support (M)**: accept LibreOffice chord sheets,
      keeping their formatting the same way `.docx` does.
- [ ] **ChordPro export (S)**: download a pasted or `.docx` sheet as `.cho`.
- [ ] **Printable chord sheet layout (M)**: print-friendly CSS and a PDF export
      for pasted text with chord-over-lyrics alignment kept.
- [ ] **Binder improvements (M)**: per-song target keys, a table of contents
      page, and reordering songs in the multi-file PDF binder.

## User interface

- [ ] **Theme toggle (S)**: a light / dark / system switch in the nav. Dark
      mode currently only follows the OS setting (`darkMode: "media"`).
- [ ] **Upload preview before download (M)**: show the transposed sheet and the
      list of chord changes for uploaded files, as the paste view already does,
      instead of downloading straight away.
- [ ] **Binder file list (M)**: show the chosen files with their names and
      sizes when several `.docx` files are dropped, with drag-to-reorder and
      remove buttons, so the binder's song order can be checked.
- [ ] **Highlight changed chords (S)**: mark the transposed chords in the output
      pane so they stand out from the lyrics, with a matching highlight on hover
      in the input pane.
- [ ] **Visual key picker (M)**: a key grid or circle-of-fifths picker with
      major and minor rows to replace the long dropdowns, and showing the
      semitone distance between the current and desired key.
- [ ] **Download pasted results (S)**: add `.txt` and `.cho` download buttons
      next to **Copy**, plus a "Copied" confirmation on the copy button.
- [ ] **Remember upload settings (S)**: store the upload panel's keys and output
      format in `prefs.js` too, as the paste panel already does.
- [ ] **Mobile layout pass (M)**: stacked panes that size to the content
      instead of two fixed-height boxes, larger tap targets on the semitone
      controls, and a sticky action bar for Copy and Stage view.
- [ ] **Clearer upload errors (S)**: show which file in a multi-file drop
      failed and why, inline next to that file instead of one message for all.

## SEO

- [ ] **Redirect removed key-pair pages (S)**: old `/transpose/<from>-to-<to>`
      URLs now return 404. Send them to the home page with a 301, preselecting
      the two keys, so any links and crawl history they had are kept.
- [ ] **Branded 404 page (S)**: replace Flask's default "404 Not Found" with a
      page in the site's style that links to the transposer and landing pages.
- [ ] **Landing pages for existing features (M)**: dedicated pages for the capo
      finder, Nashville number converter, ChordPro transposer and German
      H-notation transposer. These features exist but have no page of their own,
      and their long-tail queries are easier to rank for than "chord transposer".
- [ ] **How-to guides (M)**: short articles that answer informational queries,
      such as how to transpose chords, transposing up or down a half step, and
      how a capo changes the key, each linking to the tool.
- [ ] **Lean structured data (S)**: keep `WebApplication` and `BreadcrumbList`,
      and review `FAQPage` and `HowTo` in `src/seo.py`, which Google no longer
      shows as rich results for most sites.
- [ ] **Sitemap `lastmod` (S)**: add last-modified dates to `/sitemap.xml` so
      crawlers can see when pages change.
- [ ] **Performance budget in CI (S)**: a Lighthouse CI job in
      `.github/workflows/ci.yml` that fails when Core Web Vitals or page weight
      regress.
- [ ] **Backlinks and listings (S, ongoing)**: list the app on AlternativeTo and
      Product Hunt, and share it in musician and worship-band communities. An
      average position of 71 points to low site authority more than to on-page
      problems.
- [ ] **Measure each change (S, ongoing)**: record the date of each SEO change
      and check its effect on impressions, position and CTR in Search Console
      four weeks later.

## Musician tools

- [ ] **More instruments for chord diagrams (M)**: add mandolin and bass
      shapes, and left-handed fretboards.
- [ ] **Shareable links (S)**: encode the key, target key and options in the
      URL so a transposed result can be shared or bookmarked.
- [ ] **Stage mode polish (S)**: a screen wake lock while performing, plus
      foot-pedal and keyboard shortcuts to page through songs.

## Platform and quality

- [ ] **Installable PWA with offline paste mode (M)**: a web app manifest and
      service worker, so the in-browser transposer works without a connection.
- [ ] **Browser end-to-end tests (M)**: Playwright tests for the paste, upload,
      and binder flows, run in CI.
- [ ] **Upload hardening (S)**: per-IP rate limiting on the upload endpoints and
      clearer errors for oversized or corrupt files.
- [ ] **Dependency automation (S)**: Dependabot for pip, npm and GitHub
      Actions, plus tagged releases with a `CHANGELOG.md`.
- [ ] **Accessibility pass (S)**: keyboard navigation and screen-reader labels
      for the diagram popovers, key pickers and drop zone.

## Reach

- [ ] **Localised UI (L)**: Hungarian and German interface translations, with
      matching `hreflang` landing pages in `src/seo.py`.
- [ ] **Contributor docs (S)**: a `CONTRIBUTING.md` covering the Python and JS
      check suites and the parity harness.
