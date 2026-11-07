# Chord Transposer — Agent Rules

Small Flask app that transposes `.docx` chord sheets between musical keys.
Core logic lives in `src/transpose.py`; the web layer is `src/app.py`, and the
SEO landing pages, structured data, and sitemap are built in `src/seo.py`. The
UI is composed from partial templates under `src/templates/` (`index.html`,
`landing.html`, and the `_*.html` partials), with a prebuilt Tailwind stylesheet
and a Vite-bundled TypeScript frontend under `src/js/` (no runtime CDN). The
transpose core is mirrored in TypeScript under `src/js/transpose/` and kept in
parity with the Python implementation via a shared case harness.

## Mandatory: run all Python checks after any change

After ANY change to Python code, tests, or config, run the full check suite
before considering the task done. Use the `/check` command, or run directly:

```bash
uv run ruff check .
uv run ruff format --check .
uv run pylint src
uv run pyright
uv run pytest
```

- `pytest` is configured (in `pyproject.toml`) to run with coverage and to
  fail if combined coverage of `transpose.py`, `app.py`, and `seo.py` drops
  below 95%.
- `testpaths` includes five test files: `src/test_transpose.py`,
  `src/test_app.py`, `src/test_integration.py`, `src/test_parity.py`, and
  `src/test_api_contract.py`. All five must pass. Do not remove any from
  `testpaths`.
- `pyright` runs in strict mode (`pyrightconfig.json`; the unknown-type
  diagnostics are off because third-party libraries are partly untyped) and
  ruff enforces the `ANN` annotation rules: every function parameter and
  return type must be annotated, in application code and tests alike. Use
  Python 3.15 syntax (`list[str]`, `X | None`, `collections.abc` imports);
  prefer precise types or `typing.cast` over `Any`, and never add
  `# type: ignore` / `# pyright: ignore` comments.
- Annotations are evaluated lazily (Python 3.14+), so ruff removes quotes
  around type hints. Anything that inspects signatures at runtime still
  resolves them: gunicorn does for the hooks in `src/gunicorn.conf.py`, so
  types used there must be imported normally, not under `TYPE_CHECKING`.
- `ruff` and `pyright` also cover the end-to-end helpers under `e2e/support/`
  and the asset build scripts under `scripts/` (`pyrightconfig.json` includes
  `e2e` and `scripts` and resolves `src` imports). Script-only libraries such
  as `fonttools` belong in the `dev` dependency group so editors and pyright
  resolve them.
- `src/test_integration.py` contains end-to-end integration tests using real
  `.docx` bytes. When adding new behaviour to `src/transpose.py` or
  `src/app.py`, consider whether a corresponding integration test is needed
  there.
- `src/test_parity.py` replays `src/testdata/transpose_cases.json` through the
  Python core to guarantee it stays in parity with the JS port (see the parity
  section below). When you change transpose behaviour, update the shared cases
  and keep both implementations aligned.
- Fix all lint, formatting, test, and coverage failures. Never leave the suite red.
- If a change lowers coverage, add or update tests to restore it.

## Mandatory: run all frontend checks after any frontend change

After ANY change to files under `src/js/`, run the format check, the type check
and the frontend test suite with coverage before considering the task done:

```bash
npm run format:check
npm run typecheck
npm run test:js
```

- `npm run format:check` runs Prettier (`.prettierrc`, `.prettierignore`) over
  the TypeScript sources, tests and frontend config files; `npm run format`
  rewrites them. Python, templates, Markdown, the parity fixture and the built
  assets are ignored.

- `npm run typecheck` runs `tsc -b` over `tsconfig.app.json` (every `.ts` file
  under `src/js/`, tests included) and `tsconfig.node.json` (`vite.config.ts`).
  The compiler options follow the strict create-vite baseline plus
  `noUncheckedIndexedAccess` and `noImplicitOverride`. Keep the code free of
  `any` and of casts: validate untrusted data with type guards (`isKeyDetection`,
  `isInstrument`, `sanitizePrefs`) instead of asserting its shape. Non-null
  assertions are reserved for regex capture groups that always participate;
  tests may also use them for fixture-guaranteed elements.
- Chord symbols are parsed in one place, `parseChordCore` in
  `src/js/transpose/chords.ts`; `mapChordRoots` rewrites the root and bass of a
  symbol for both transposition and Nashville numbering. Note lookups throw
  `UnknownNoteError` for names outside the tables, so the chord grammar (shared
  with `src/transpose.py`) must only admit roots the tables know.
- Required DOM elements are fetched with `requireElement` / `requireSelector`
  from `src/js/dom.ts`, which throw a named error when the markup is missing an
  element, so new panels should use them instead of raw `getElementById`.

- Tests run under Vitest (`jsdom`) with V8 coverage, configured in
  `vite.config.ts`. Coverage is enforced at 100% for statements, branches,
  functions and lines. Cover every new branch with a test rather than adding
  unreachable defensive guards.
- Every module under `src/js/` has a matching `*.test.ts`. When adding a new
  module or behaviour, add or extend the corresponding test so the thresholds
  stay green. Coverage counts the right-hand side of `??` and `||` and every
  early-return guard as a branch, so unreachable fallbacks show up as misses.
- Fix all test and coverage failures. Never leave the suite red. If a change
  lowers coverage, add or update tests to restore it.
- CI runs all three in a separate `frontend` job (`.github/workflows/ci.yml`)
  alongside the Python `checks` job.
- `npm run typecheck` also covers the end-to-end suite through
  `tsconfig.e2e.json` (`e2e/` and `playwright.config.ts`).

## Mandatory: run the end-to-end suite after any user-facing change

After ANY change to templates, `src/js/`, `src/app.py` endpoints or
`src/static/`, run the Playwright suite before considering the task done:

```bash
npm run test:e2e                          # every browser project
npm run test:e2e -- --project=chromium    # one project while iterating
```

- The suite lives under `e2e/`: `specs/` holds one spec per feature area,
  `pages/` the page objects the specs drive (`HomePage`, `PastePanel`,
  `UploadPanel`, `KeyPicker`, ...), and `support/` the harness. Import `test`
  and `expect` from `e2e/support/test.ts`, never from `@playwright/test`
  directly: it provides the page objects, a clipboard recorder, and fails any
  test whose page throws an uncaught error.
- `playwright.config.ts` starts the app under gunicorn and a fake Gotenberg
  (`e2e/support/fake_gotenberg.py`) that turns each uploaded .docx into a text
  PDF, so PDF and binder downloads are asserted on their content. A paragraph
  equal to `pdfConversionFailureMarker` makes it fail the conversion.
- Ports are derived from a hash of the checkout path
  (`e2e/support/port.ts`), so parallel worktrees never share a server. Set
  `E2E_PORT` to override (the fake Gotenberg uses the next port) and
  `E2E_PYTHON` to pick the interpreter (default: the `.venv/bin/python` that
  `uv sync` creates; the run stops with a hint when it is missing). Servers
  are never reused, so a port clash fails loudly.
- `e2e/support/build_fixtures.py` writes the .docx fixtures into
  `e2e/.generated/` before each run; text fixtures live in `e2e/fixtures/`.
- Projects: `chromium`, `firefox` and `webkit` run every spec; `mobile-chrome`
  and `mobile-safari` run only tests tagged `@mobile`. Tag a test `@mobile`
  when its flow matters on a phone layout.
- Avoid `backdrop-filter` in the UI: headless WebKit renders it in software at
  under one frame per second, which stalls the WebKit e2e projects.
- Known bugs are recorded as `test.fail()` tests named `known issue: ...`; when
  the bug is fixed the test starts passing and the suite goes red until the
  marker is removed.
- The suite runs against the committed `src/static/` assets, so rebuild them
  first. CI runs it as one `e2e (<browser>)` job per engine inside the
  `mcr.microsoft.com/playwright:v<version>-noble` image (browsers and system
  libraries preinstalled, no install step). Its tag must match the
  `@playwright/test` version in `package-lock.json`; bump both together. The
  same image runs WebKit locally where the host cannot. The
  `frontend` job fails when `npm run build` changes `src/static/`.

## Frontend bundle (Vite build)

- The browser code under `src/js/` is bundled by Vite (`vite.config.ts`) into
  hashed assets under `src/static/js/`, with a `manifest.json` mapping the
  entries (`main.ts`, `landing.ts`) to their hashed filenames. `app.py` reads
  that manifest (`_resolve_js_bundle`) to inject the correct `js_bundle` URL
  into templates, falling back to an unhashed path when the manifest is absent.
- After changing any file under `src/js/`, rebuild with `npm run build:js` (or
  `npm run build` to rebuild CSS and JS together) and commit the regenerated
  `src/static/js/` output, including `manifest.json`. The Docker image ships
  these files as-is and does not run Node.

## JS/Python transpose parity

- `src/transpose.py` and `src/js/transpose/` are two implementations of the same
  core and must stay in lockstep. `src/testdata/transpose_cases.json` is the
  shared case harness: `src/test_parity.py` replays it through Python and
  `src/js/transpose/parity.test.ts` replays it through TypeScript.
- When you change transpose behaviour, update both implementations and the
  shared cases, then run both `pytest` and `npm run test:js`.
- A `/binder` error caused by one file carries an `index` field with that
  file's position in the upload next to `error` (the message names the file).
  The upload panel flags that song in its binder list, keeps the flag while
  the songs are reordered, and blocks resubmitting it. Keep the field when
  adding new per-file binder errors.
- The HTTP boundary has its own shared harness:
  `src/testdata/api_contract_cases.json` records exact request/response pairs
  for every endpoint the frontend calls. `src/test_api_contract.py` replays
  them against the Flask app and `src/js/api-contract.test.ts` replays them
  against the upload frontend. When you change an endpoint's fields, payloads,
  headers, or messages, update the fixture and keep both suites green.

## Styling (Tailwind build)

- Styling is a prebuilt file at `src/static/tailwind.css`, generated by
  Tailwind CSS v4 (`@tailwindcss/cli`) from `src/styles/tailwind.input.css`,
  which holds the whole configuration: the self-hosted `@font-face` rules, the
  `@theme` fonts and colour tokens, the component classes, the `dark` variant
  (kept in step with the theme switch below, though no markup uses it), and
  the `@source` list of scanned files
  (templates and `src/js/`, tests excluded). There is no `tailwind.config.js`
  and no runtime CDN.
- Templates share a masthead (`_masthead.html`, whose wordmark is the `<h1>` on
  the home page only) and the key controls macros in `_key_controls.html`
  (`key_field`, `swap_button`, `key_picker`), used by both panels.
- Colours are semantic tokens (`desk`, `paper`, `ink`, `graphite`, `pencil`,
  `rule`, `rule-strong`, `vermilion`, `ok`, `error`) declared with
  `@theme inline` over CSS variables. Each variable on `:root` holds both
  values as `light-dark(light, dark)`, so the palette follows `color-scheme`
  and markup needs no `dark:` variants; add a colour as a token rather than a
  raw hex or a Tailwind palette colour.
- The theme is `data-theme="light" | "dark"` on `<html>` (absent means follow
  the system), set by `src/js/theme.ts` and saved under
  `chord-transposer:theme`. An inline script in `_head.html` applies the saved
  theme before the stylesheet loads to avoid a flash; keep its storage key in
  step with `THEME_STORAGE_KEY`. The masthead switch is the one control styled
  from `:root[data-theme]` rather than its `aria-pressed`, so the chosen theme
  shows before the script runs.
- Repeated controls are component classes in `@layer components` (`.btn`,
  `.seg` / `.seg-option`, `.tab`, `.key-trigger`, `.keyboard`, `.sheet`,
  `.notice`, ...). Their selected state is styled from `aria-selected`,
  `aria-pressed` or a checked input, so scripts toggle the ARIA attribute
  instead of adding classes.
- The two side-by-side sheets share `.sheet-text`, which pins font, size,
  line height and padding to whole pixels so input and output lines stay
  aligned; style both panes through it, never one alone.
- Fonts are self-hosted under `src/static/fonts/` (see its README for sources
  and licences). The Latin subsets lack ♭ ♮ ♯, so `scripts/build_accidentals_font.py`
  cuts them from Noto Music into a tiny font layered first in the sans and
  serif stacks via `unicode-range`. Everything under `/static/` is served
  immutable, so ship a changed font under a new file name.
- The social card `src/static/og-image.png` is rendered from
  `scripts/og-image/og-image.html` with `node scripts/og-image/render.mjs`
  (it uses the bundled fonts); edit the HTML and re-render rather than editing
  the PNG.
- After changing any template markup (classes) or `src/styles/tailwind.input.css`,
  rebuild with `npm run build:css` and commit the regenerated
  `src/static/tailwind.css`. The Docker image ships this file as-is and does
  not run Node.
- The stylesheet URL is cache-busted with `?v={{ css_version }}`, where
  `css_version` is a content hash computed in `app.py`. Static assets are served
  `immutable`; HTML is served `no-cache`.

## SEO page dates

- Every indexable page carries a `lastmod` date in `src/seo.py` that is
  published in `/sitemap.xml`. When you change the copy a page renders, bump
  that page's date and leave the others alone — crawlers discount `lastmod`
  values they find unreliable, so a blanket update is worse than none.

## Conventions

- Do not add explanatory code comments; use self-explanatory names instead.
- Python dependencies are managed with uv: `pyproject.toml` declares them
  (runtime in `[project]`, tooling in the `dev` group) and `uv.lock` pins
  every version. Run `uv sync` to install, `uv add` / `uv add --dev` to add a
  package, and commit `uv.lock` with any dependency change. CI and the Docker
  build use `uv sync --locked`, so a stale lock fails them.
- Python is pinned in `.python-version` (3.15) and Node.js in `.nvmrc` (26,
  the current LTS); CI and the Docker image read the same versions.
