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
ruff check .
ruff format --check .
pylint
pyright
pytest
```

- `pytest` is configured (in `pyproject.toml`) to run with coverage and to
  fail if combined coverage of `transpose.py`, `app.py`, and `seo.py` drops
  below 95%.
- `testpaths` includes four test files: `src/test_transpose.py`,
  `src/test_app.py`, `src/test_integration.py`, and `src/test_parity.py`. All
  four must pass. Do not remove any from `testpaths`.
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
  `any`; use narrow casts only at I/O boundaries and in test fixtures, and
  non-null assertions only for regex capture groups that always participate and
  for fixture-guaranteed elements in tests.
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

## Styling (Tailwind build)

- Styling is a prebuilt file at `src/static/tailwind.css`, generated by Tailwind
  from `src/styles/tailwind.input.css` and `tailwind.config.js`. There is no
  runtime CDN.
- After changing any template markup (classes) or `tailwind.config.js`, rebuild
  with `npm run build:css` and commit the regenerated `src/static/tailwind.css`.
  The Docker image ships this file as-is and does not run Node.
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
- Install dev tooling with `pip install -r requirements-dev.txt`.
