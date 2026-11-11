# Roadmap

Planned work for Chord Transposer, live at [chordtransposer.app](https://chordtransposer.app/).
Items are grouped by theme and roughly ordered by priority within each group.
Sizes are rough estimates: **S** ≈ half a day, **M** ≈ 1–2 days, **L** ≈ 3+ days.
Finished items are removed from this file rather than ticked; `git log` is the
record of what shipped.

## Transposition engine

- [ ] **Bar lines and repeat markers (S)**: lines such as `| C | G | Am | F |`,
      `C G Am F x2` and `Am F C G (2x)` are left untouched, because `|` is not
      in `PUNCTUATION` and `x2` / `2x` read as lyric words, so `is_chord_line`
      rejects the whole line. Treat bar lines (`|`, `||`, `|:`, `:|`), repeat
      marks (`x2`, `2x`, `%`) and rhythm slashes (`/ / / /`) as decorations in
      `_is_decoration` and its TypeScript twin, with shared parity cases.
- [ ] **Inline chords in lyric lines (M)**: `(G) Amazing grace, how (C) sweet
      the (G) sound` is skipped as lyrics because one lyric word disqualifies
      the line. Transpose bracketed chord tokens inside lyric lines when the
      line holds at least two of them, so hymnals and songbooks that print
      chords between the words work without converting to ChordPro. Needs a
      false-positive guard for lines like `(A) side note`.
- [ ] **Semitone and Nashville modes for uploads (M)**: the paste panel
      transposes by key, by semitones or to Nashville numbers; the upload panel
      only transposes by key. Both cores already have
      `transpose_text_by_semitones` and `text_to_nashville`;
      `transpose_document_bytes` needs a semitone entry point and a Nashville
      writer for `.docx`, plus a mode switch in `_panel_upload.html` and new
      contract cases.

## Input and output formats

- [ ] **Monospace text-to-PDF output (S)**: `_text_to_docx_bytes` in
      `src/app.py` builds the intermediate document in Word's default
      proportional font, so `.pdf` downloads of `.txt` / `.cho` uploads lose the
      chord-over-lyric alignment the sheet depends on. Give the paragraphs a
      monospace style (Liberation Mono is available in the Gotenberg image),
      set page margins and keep blank lines as paragraphs. Every text-based
      export below reuses this renderer, so it comes first.
- [ ] **`.docx` output for text uploads (S)**: the same helper already produces
      a Word document; offer `.docx` as a format for `.txt` / `.pro` / `.cho`
      uploads (and later for PDF imports) so a plain sheet can be taken into
      Word for further editing.
- [ ] **PDF import, in-place rewrite (M)**: accept `.pdf` chord sheets and give
      back a `.pdf` with only the chord strings rewritten, leaving every other
      byte on the page untouched, so the formatting is never disturbed rather
      than reconstructed. Measured as workable with `pypdf` alone, already a
      dependency: a realistic LibreOffice-style export stores each run as its
      own positioned string, so swapping `C` for `D` inside it keeps fonts,
      sizes, colours, images and margins identical. Needs pypdf's content-stream
      parser rather than a regex, because real exports use hex `TJ` kerning
      arrays (`[<43>] TJ`), CID/subset font decoding through `ToUnicode`, and a
      glyph-availability check so a sheet that never printed `#` does not render
      `F#` as a missing box. Refuse anything it cannot rewrite cleanly instead
      of guessing, and add fixture PDFs from Word, LibreOffice, Google Docs and
      Ultimate Guitar to the integration and e2e suites.
- [ ] **PDF text extraction for preview and text exports (S, with the item
      above)**: `pypdf`'s layout extraction mode reproduced a chord sheet with
      its columns intact in one call, so the same upload can feed key
      detection, the editable preview, and `.txt` / `.cho` / plain `.docx`
      downloads. Show a "layout read from PDF" note in the preview, and reject
      scanned PDFs with a clear "no text layer" message.
- [ ] **ChordPro export from chord-over-lyric sheets (M)**: convert a chord line
      and the lyric line under it into inline `[G]` markup by column position,
      the inverse of the existing `chordpro_to_plain`, so pasted and `.docx`
      sheets can be downloaded as `.cho`.
- [ ] **OpenDocument (.odt) support (M)**: accept LibreOffice chord sheets,
      keeping their formatting the same way `.docx` does.
- [ ] **Printable chord sheet layout (M)**: `tailwind.input.css` has no
      `@media print` rules, so printing the page prints the whole UI. Add a
      print stylesheet for the output pane and stage view with
      chord-over-lyrics alignment kept, and a PDF export for pasted text
      through the text route.
- [ ] **Binder improvements (M)**: per-song target keys, a table of contents
      page, and reordering songs in the multi-file PDF binder.

### PDF import: decision notes

Question: should readers be able to upload a PDF and download the transposed
result as `.docx` or `.pdf`, with the formatting kept?

**Answer, measured rather than assumed.** PDF in, PDF out: yes, and the
formatting is genuinely intact. PDF in, formatted `.docx` out: no. Offer the
text of a PDF as a plain `.docx`, but do not promise its formatting.

**Why PDF is different.** A `.docx` stores paragraphs and runs, so chords are
rewritten in place and every other property survives untouched. A PDF stores
positioned glyphs: no paragraphs, no lines, fonts usually embedded as subsets
holding only the glyphs the page used, and the gap between chords is often
absolute positioning rather than space characters. Scanned PDFs hold no text at
all. Anything that turns a PDF back into a document model is guessing.

**Options, with what testing showed.**

1. *In-place rewrite (recommended).* Overwrite only the chord strings in the
   content stream. Verified end to end with `pypdf` 6.21.4 (BSD, already a
   dependency) on a hand-built sheet: the four chord operators changed, the
   lyric line and every coordinate stayed byte-identical, and the result
   re-extracted as `D A Bm G`. No new dependency and no licence question.
   Kept: everything except the chord text itself. Risks: subset fonts missing
   a needed accidental glyph, and a longer chord overrunning into its
   neighbour, which is mild on chord sheets because each chord is
   independently positioned and usually widely spaced.
2. *Text-layer extraction.* `pypdf`'s layout mode returned the chord sheet with
   columns aligned in a single call, which covers preview, key detection and
   text downloads. Kept: text, line order, column alignment. Lost: all
   typography. Fails cleanly on scanned PDFs. Pairs with option 1 rather than
   competing with it.
3. *PDF to `.docx` conversion, then the existing `.docx` pipeline.* Tested and
   rejected. pdf2docx 0.5.13 (MIT, but hard-depending on AGPL PyMuPDF) was run
   over a LibreOffice-style export of this project's own
   `input/Amazing_Grace_C.docx`, then pushed through the real pipeline:

   | Document | Paragraphs | Soft breaks | Tabs | Chord lines found | Chords transposed |
   | --- | --- | --- | --- | --- | --- |
   | Original `.docx` | 32 | 1 | 0 | 11 | 8 |
   | pdf2docx, defaults | 6 | 22 | 13 | 0 | 0 |
   | pdf2docx, tuned | 6 | 22 | 13 | 0 | 0 |

   The converter merged each whole verse into one paragraph with line breaks
   inside it, so `is_chord_line` sees lyrics and skips the lot; it replaced
   leading spaces with tab characters, so chord columns depend on Word tab
   stops instead of character positions; and it fused adjacent lines, gluing
   `Verse 2` onto the end of the chorus lyric. Retrying with every
   paragraph-splitting setting at maximum changed nothing. The alignment
   information is destroyed before any of this project's code runs, so no
   downstream fix recovers it. Commercial engines (Adobe, Smallpdf, iLovePDF)
   use the same gaps-to-tabs strategy, charge per page, and would mean sending
   reader files to a third party against the FAQ's promise.
4. *OCR for scanned PDFs* (ocrmypdf / Tesseract). A heavy server dependency
   with error-prone chord recognition (`B` vs `8`, `#` vs `♯`). Out of scope
   unless demand appears.

**What can be guaranteed.** With option 1, for born-digital PDFs the rewriter
accepts: untouched content is byte-for-byte identical and chord tokens keep
their position and size, with font matching best-effort. With option 2: complete
text, line order and column alignment, nothing typographic. Both verified
against a fixture corpus in `src/test_integration.py` and the e2e suite.

**Verdict.** Worth doing, leading with the in-place rewrite. PDF is the most
common chord-sheet format in the wild and "transpose pdf chord sheet" is a
landing-page query the site cannot answer today.

## User interface

- [ ] **Highlight changed chords on hover (S)**: transposed chords in the output
      pane are drawn in the accent colour; hovering one should highlight the
      matching chord in the input pane, and vice versa.
- [ ] **Download pasted results (S)**: add `.txt` and `.cho` download buttons
      next to **Copy** (the "Copied" confirmation already exists), reusing the
      text routes for `.pdf` and `.docx` once those formats land.
- [ ] **Remember upload settings (S)**: store the upload panel's keys and output
      format in `prefs.ts` too; today only the paste panel reads and writes
      preferences.
- [ ] **Mobile layout pass (M)**: phones show one sheet at a time with a
      "Your chords / Transposed" switch, and the semitone controls have 44px
      tap targets. Still open: a sticky action bar for Copy and Stage view.

## SEO

- [ ] **Redirect URL variants (S)**: trailing-slash and uppercase versions of
      landing URLs (e.g. `/guitar-chord-transposer/`) currently 404, losing any
      links that generate them. 301 slash and case variants to the canonical
      lowercase, slashless URL.
- [ ] **Response compression (S)**: nothing in the stack compresses responses —
      gunicorn, Flask, and Railway's proxy all send HTML, CSS, and JS
      uncompressed, and HTML is `no-cache` so it is paid on every visit. Add
      `flask-compress` (brotli/gzip) to cut transfer roughly 70% and feed the
      Core Web Vitals budget.
- [ ] **Landing pages for existing features (M)**: dedicated pages for the capo
      finder, Nashville number converter, ChordPro transposer and German
      H-notation transposer, plus a PDF chord transposer page once PDF import
      ships. These features exist but have no page of their own, and their
      long-tail queries are easier to rank for than "chord transposer".
- [ ] **How-to guides (M)**: short articles that answer informational queries,
      such as how to transpose chords, transposing up or down a half step, and
      how a capo changes the key, each linking to the tool.
- [ ] **Privacy and about pages (S)**: the FAQ claims uploaded files are not
      stored, but no page substantiates who runs the site or how uploads are
      handled. Short `/privacy` and `/about` pages add E-E-A-T trust signals
      and give directories something to link besides the home page.
- [ ] **Cache headers for root-served assets (S)**: `/og-image.png` (107 KB),
      `/favicon.ico`, and `/favicon.svg` are served by custom routes outside
      `/static/`, so they miss the `immutable` cache header in `src/app.py`
      and are re-fetched on every visit.
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
- [ ] **Stage mode polish (S)**: foot-pedal support (page-turner pedals send
      arrow or page keys) and paging through several songs.

## Platform and quality

- [ ] **One upload parser in `src/app.py` (S)**: `/detect-key`, `/transpose`,
      `/transpose-text` and `/binder` each repeat the file, extension, key, size
      and format checks with slightly different wording, `/transpose` has no
      10 MB per-file check at all (only the 40 MB `MAX_CONTENT_LENGTH`
      applies), and it formats its change header inline next to the
      `_changes_header` helper the text route uses. Extract an upload reader
      and a single error-response helper, and update
      `api_contract_cases.json` for any message that changes.
- [ ] **Browser-side key detection for uploads (S)**: `upload.ts` already
      extracts a dropped `.docx` with `extractDocxParagraphs` for the preview,
      yet still posts the file to `/detect-key` for the key guess, so every
      selection uploads the file twice. `detectKey` is exported from
      `src/js/transpose/`; run it on the extracted paragraphs as the text
      branch already does, then retire `/detect-key` and its contract cases.
- [ ] **Upload hardening (S)**: per-IP rate limiting on `/transpose`,
      `/transpose-text`, `/binder` and `/detect-key` (until it is retired), and
      clearer errors for oversized or corrupt files. Every one of them parses
      untrusted zip/XML input without authentication.
- [ ] **Security headers (S)**: no response sets `Content-Security-Policy`,
      `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy`. The
      inline theme script in `_head.html` and the JSON-LD blocks need a hash
      or nonce in the CSP; everything else is same-origin.
- [ ] **Quieter request logging (S)**: `log_request_start` and
      `log_request_end` log every request at INFO on top of gunicorn's access
      log, three lines per request. Keep one, or demote the Flask pair to
      DEBUG.
- [ ] **Installable PWA with offline paste mode (M)**: a web app manifest and
      service worker, so the in-browser transposer works without a connection.
- [ ] **Accessibility pass (S)**: keyboard navigation and screen-reader labels
      for the diagram popovers, key pickers and drop zone, with an axe-core
      check (`@axe-core/playwright`) in the page-health e2e spec so regressions
      fail CI.
- [ ] **Visual regression snapshots (S)**: `toHaveScreenshot` on Chromium for
      the home page, both panels, stage view and the 404 page in light and dark
      themes, so the paper-and-ink redesign is protected against drift.
## Reach

- [ ] **Localised UI (L)**: Hungarian and German interface translations, with
      matching `hreflang` landing pages in `src/seo.py`.
- [ ] **Contributor docs (S)**: a `CONTRIBUTING.md` covering the Python and JS
      check suites, the parity and API-contract harnesses, and the e2e setup.
