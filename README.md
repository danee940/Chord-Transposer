# Chord Transposer

Web app for transposing `.docx` chord sheets between musical keys. Preserves document formatting and supports both standard and German (H-notation) chord notation.

## Usage

### Web app

```bash
uv sync
uv run flask run
```

[uv](https://docs.astral.sh/uv/) installs the pinned Python version (`.python-version`) and
the locked dependencies (`uv.lock`) into `.venv/`.

Open `http://localhost:5000`, upload a `.docx` chord sheet and pick the current and target key. A live preview shows the transposed sheet with its chord changes; correct any chord in the preview (edits follow along when you change key) and download the file with your corrections applied.

### CLI

```bash
uv run src/transpose.py
```

Processes all `.docx` files in `input/` and saves results to `output/`.

### Docker

```bash
docker compose up
```

Runs the app on `http://localhost:5000` alongside a Gotenberg service for PDF conversion.

## Deploy to Railway

The app needs a companion Gotenberg service for PDF output, so a Railway project
runs two services:

1. Create a Railway project and add this repository. Railway builds the app from
   the `Dockerfile` (see `railway.json`) and injects `PORT`.
2. Add a second service from the Docker image `gotenberg/gotenberg:8`.
3. On the app service, set `GOTENBERG_URL` to the Gotenberg service's private
   address, e.g. `http://gotenberg.railway.internal:3000`.
4. Generate a public domain for the app service. Railway terminates HTTPS.

The `/health` endpoint is used as the deploy healthcheck.

## Frontend assets

Both the stylesheet and the browser bundle are prebuilt and shipped as normal
static assets, so no CDN runs in the browser. The Docker image ships these files
as-is and does not run Node.

- **CSS**: Tailwind builds `src/static/tailwind.css` from `src/styles/tailwind.input.css`.
- **Fonts**: IBM Plex Sans, IBM Plex Mono, Source Serif 4 and a three-glyph
  accidentals font cut from Noto Music, all OFL and self-hosted under
  `src/static/fonts/` (sources in its `README.md`).
- **Social card**: `src/static/og-image.png` is rendered from
  `scripts/og-image/og-image.html`; re-render with `node scripts/og-image/render.mjs`.
- **JS**: Vite bundles the TypeScript sources under `src/js/` into hashed assets
  under `src/static/js/` with a `manifest.json`; `app.py` reads the manifest to
  inject the correct bundle URL.

Both committed outputs are cache-busted (CSS via a `?v=` content hash, JS via
hashed filenames) and served with a long-lived immutable cache header, while HTML
pages are sent with `no-cache`.

Rebuild after changing markup, `src/styles/tailwind.input.css`, or any file under `src/js/`:

The frontend tooling targets the Node.js LTS release in `.nvmrc`.

```bash
npm install
npm run build       # CSS + JS; or build:css / build:js individually
```

Use `npm run watch:css` (CSS) or `npm run dev` (JS watch) during development.
Commit the regenerated `src/static/tailwind.css` and `src/static/js/`.

## Development

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Add or upgrade Python dependencies with `uv add <package>` (`--dev` for tooling) or
`uv lock --upgrade`, and commit the updated `uv.lock`.

Combined coverage of `transpose.py`, `app.py`, and `seo.py` must stay at or
above 95%.

Frontend modules under `src/js/` are strict TypeScript with their own format
check, type check and coverage-gated suite:

```bash
npm run format:check
npm run typecheck
npm run test:js
```

End-to-end tests drive the real app in Chromium, Firefox and WebKit (plus
mobile Chrome and Safari layouts) with Playwright. They start the app and a fake
PDF service on ports derived from the checkout path, so several worktrees can
run them at once:

```bash
npx playwright install --with-deps   # once, to download the browsers
npm run test:e2e
```

Run `uv run src/samples.py` to write a sample chord sheet (`input/Amazing_Grace_C.docx`) for trying the upload flow locally; the same sheet drives the preview-edit integration tests.

## Roadmap

Planned features and improvements are tracked in [ROADMAP.md](ROADMAP.md).

## Support

If you find this project useful, you can support its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/danee940)

## License

Licensed under the MIT License. See [LICENSE](LICENSE) for the full text.

Copyright (C) 2026 Aierizer Dániel
