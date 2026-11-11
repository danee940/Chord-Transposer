# Changelog

All notable changes to Chord Transposer are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Versions are git tags of the form
`v1.2.3`; the same number is kept in `pyproject.toml` and `package.json`.

## [Unreleased]

### Changed

- The Python core is a package, `src/transpose/`, with one module per concern;
  the CLI is now `python -m transpose`.
- The upload and paste panels are wired from small controller modules
  (`upload-*.ts`, `paste-*.ts`) instead of two large closures.

### Added

- `/health` reports whether the PDF service is reachable (`"pdf": "up"|"down"`)
  without ever failing the app's own liveness check.
- Dependabot keeps uv, npm, GitHub Actions and Docker dependencies current, and
  CI fails when the hand-pinned Playwright image or uv version drifts from the
  versions installed from the lock files.

### Fixed

- The PDF binder converts and merges all songs in one Gotenberg request instead
  of one round-trip per song, so large binders no longer risk the worker
  timeout; `pypdf` is no longer a runtime dependency.

### Removed

- The unreferenced `og-preview.png` at the repository root.

## [1.0.0] - 2026-11-07

First public release at [chordtransposer.app](https://chordtransposer.app/):
paste or upload `.docx`, `.txt` and ChordPro chord sheets, transpose by key or
semitones, Nashville numbers, capo suggestions, chord diagrams, a stage view,
key detection, German H notation, an editable upload preview, and a multi-file
PDF binder.

[Unreleased]: https://github.com/danee940/Chord-Transposer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/danee940/Chord-Transposer/releases/tag/v1.0.0
