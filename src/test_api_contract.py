"""API contract fixture executed against the Flask backend.

The same ``src/testdata/api_contract_cases.json`` fixture is executed against
the browser code by ``src/js/api-contract.test.ts``: this side replays each
recorded request against the real Flask app and asserts the exact response
(status, JSON payload, headers, body), while the JS side asserts that the
frontend sends exactly the recorded request and can consume the recorded
response. Changing either side without updating the fixture fails one of the
two suites, so the API cannot silently drift.
"""

import json
from collections.abc import Iterator
from io import BytesIO
from pathlib import Path
from typing import Any, cast

import pytest
from docx import Document
from flask.testing import FlaskClient
from pypdf import PdfWriter

import app as app_module

FIXTURE_PATH = Path(__file__).resolve().parent / "testdata" / "api_contract_cases.json"
CASES = cast(list[dict[str, Any]], json.loads(FIXTURE_PATH.read_text(encoding="utf-8")))


@pytest.fixture
def client() -> Iterator[FlaskClient]:
    app_module.app.config["TESTING"] = True
    with app_module.app.test_client() as test_client:
        yield test_client


def _docx_bytes(text: str) -> bytes:
    """Build .docx bytes with one paragraph per line of text."""
    document = Document()
    for line in text.split("\n"):
        document.add_paragraph(line)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _one_page_pdf() -> bytes:
    """Return minimal valid PDF bytes, standing in for the Gotenberg service."""
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def _file_payload(spec: dict[str, Any]) -> bytes:
    """Build the upload bytes for a fixture file spec."""
    content = cast(str, spec["content"])
    if spec["raw"] or not cast(str, spec["filename"]).endswith(".docx"):
        return content.encode("utf-8")
    return _docx_bytes(content)


def _apply_backend_stubs(case: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub the external PDF service boundary as the fixture case requires."""
    backend = case.get("backend", {})
    if backend.get("pdf_stub"):
        monkeypatch.setattr(app_module, "convert_docx_to_pdf", lambda _docx: _one_page_pdf())
    if backend.get("gotenberg_down"):
        monkeypatch.setenv("GOTENBERG_URL", "http://127.0.0.1:9")


@pytest.mark.parametrize("case", CASES, ids=[case["description"] for case in CASES])
def test_contract_case(
    case: dict[str, Any], client: FlaskClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The backend responds to each recorded request exactly as the fixture says."""
    _apply_backend_stubs(case, monkeypatch)

    data: dict[str, Any] = {}
    for spec in case["request"]["files"]:
        data.setdefault(spec["field"], []).append((BytesIO(_file_payload(spec)), spec["filename"]))
    data.update(case["request"]["form"])

    response = client.post(case["endpoint"], data=data)
    expected = case["response"]

    assert response.status_code == expected["status"]
    if "json" in expected:
        assert response.get_json() == expected["json"]
    if "content_type" in expected:
        assert response.headers["Content-Type"] == expected["content_type"]
    for name, value in expected.get("headers", {}).items():
        assert response.headers.get(name) == value
    if "body_text" in expected:
        assert response.get_data(as_text=True) == expected["body_text"]


def test_upload_form_uses_the_contract_field_names(client: FlaskClient) -> None:
    """The upload form's input names match the /transpose contract fields.

    The browser builds the /transpose request with ``new FormData(form)``, so
    the field names come from this template rather than from TypeScript code.
    """
    transpose_case = next(case for case in CASES if case["endpoint"] == "/transpose")
    html = client.get("/").get_data(as_text=True)
    for field in transpose_case["fields"]:
        assert f'name="{field}"' in html
