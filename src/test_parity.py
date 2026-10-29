"""Shared parity fixture executed against the Python transpose core.

The same ``src/testdata/transpose_cases.json`` fixture is executed against the
JavaScript core by ``src/js/transpose/parity.test.js`` so the two
implementations cannot silently drift.
"""
# pylint: disable=missing-function-docstring,protected-access,too-many-return-statements

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast

import pytest

import transpose as t

FIXTURE_PATH = Path(__file__).resolve().parent / "testdata" / "transpose_cases.json"
CASES = cast("list[dict[str, Any]]", json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))


def _changes(pairs: Iterable[tuple[str, str]]) -> list[list[str]]:
    return [list(pair) for pair in pairs]


def _run_case(case: dict[str, Any]) -> dict[str, Any]:
    mode = case["mode"]
    text = case["input"]
    params = case["params"]

    if mode == "key":
        result, from_label, to_label, changes = t.transpose_text(
            text, params["current_key"], params["target_key"]
        )
        return {
            "text": result,
            "from": from_label,
            "to": to_label,
            "changes": _changes(changes),
        }
    if mode == "semitones":
        result, normalised, changes = t.transpose_text_by_semitones(
            text, params["semitones"], params["use_flats"]
        )
        return {"text": result, "semitones": normalised, "changes": _changes(changes)}
    if mode == "chordpro-key":
        result, from_label, to_label, changes = t.transpose_chordpro_text(
            text, params["current_key"], params["target_key"]
        )
        return {
            "text": result,
            "from": from_label,
            "to": to_label,
            "changes": _changes(changes),
        }
    if mode == "chordpro-semitones":
        result, normalised, changes = t.transpose_chordpro_text_by_semitones(
            text, params["semitones"], params["use_flats"]
        )
        return {"text": result, "semitones": normalised, "changes": _changes(changes)}
    if mode == "chordpro-key-plain":
        result, from_label, to_label, changes = t.transpose_chordpro_text(
            text, params["current_key"], params["target_key"]
        )
        return {
            "text": t.chordpro_to_plain(result),
            "from": from_label,
            "to": to_label,
            "changes": _changes(changes),
        }
    if mode == "to-plain":
        return {"text": t.chordpro_to_plain(text)}
    if mode == "is-chordpro":
        return {"result": t.is_chordpro_text(text)}
    if mode == "detect-key":
        return dict(t.detect_key(text))
    if mode == "nashville":
        result, tonic = t.text_to_nashville(text, params["tonic_key"])
        return {"text": result, "tonic": tonic}
    raise AssertionError(f"unknown mode: {mode}")


def test_fixture_is_not_empty() -> None:
    assert len(CASES) > 0


@pytest.mark.parametrize("case", CASES, ids=[c["description"] for c in CASES])
def test_python_core_matches_fixture(case: dict[str, Any]) -> None:
    assert _run_case(case) == case["expected"]
