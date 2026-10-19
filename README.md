# Chord Transposer

Web app for transposing `.docx` chord sheets between musical keys. Preserves document formatting and supports both standard and German (H-notation) chord notation.

## Usage

### Web app

```bash
pip install -r requirements-dev.txt
flask run
```

Open `http://localhost:5000`, upload a `.docx` chord sheet, select the current and target key, and download the transposed file.

### CLI

```bash
python src/transpose.py
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

Both the stylesheet and the browser JavaScript are prebuilt and shipped as normal
static assets, so no CDN runs in the browser. The Docker image ships these files
as-is and does not run Node.

- **CSS**: Tailwind builds `src/static/tailwind.css` from `src/styles/tailwind.input.css`.
- **JS**: Vite bundles `src/js/` into hashed assets under `src/static/js/` with a
  `manifest.json`; `app.py` reads the manifest to inject the correct bundle URL.

Both committed outputs are cache-busted (CSS via a `?v=` content hash, JS via
hashed filenames) and served with a long-lived immutable cache header, while HTML
pages are sent with `no-cache`.

Rebuild after changing markup, `tailwind.config.js`, or any file under `src/js/`:

```bash
npm install
npm run build       # CSS + JS; or build:css / build:js individually
```

Use `npm run watch:css` (CSS) or `npm run dev` (JS watch) during development.
Commit the regenerated `src/static/tailwind.css` and `src/static/js/`.

## Development

```bash
pip install -r requirements-dev.txt
ruff check .
ruff format --check .
pytest
```

Combined coverage of `transpose.py`, `app.py`, and `seo.py` must stay at or
above 95%.

Frontend modules under `src/js/` have their own coverage-gated suite:

```bash
npm run test:js
```

## Support

If you find this project useful, you can support its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/danee940)

## License

Licensed under the MIT License. See [LICENSE](LICENSE) for the full text.

Copyright (C) 2026 Aierizer Dániel
