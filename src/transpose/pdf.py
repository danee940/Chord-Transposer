"""Conversion of .docx bytes to PDF through the Gotenberg service."""

import os
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

import requests

from .errors import PdfConversionError

DEFAULT_GOTENBERG_URL = "http://localhost:3000"
PDF_CONVERSION_TIMEOUT_SECONDS = 120
PDF_HEALTH_TIMEOUT_SECONDS = 2
PDF_HEALTH_CACHE_SECONDS = 30

DOCX_MIMETYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MERGED_PART_NAME_DIGITS = 4

UploadPart = tuple[str, tuple[str, bytes, str]]


def _gotenberg_url() -> str:
    """Return the base URL of the Gotenberg conversion service."""
    return (os.environ.get("GOTENBERG_URL") or DEFAULT_GOTENBERG_URL).rstrip("/")


def _convert(files: Sequence[UploadPart], data: Mapping[str, str]) -> bytes:
    """Post documents to Gotenberg's LibreOffice route and return the PDF it produces."""
    endpoint = f"{_gotenberg_url()}/forms/libreoffice/convert"
    try:
        response = requests.post(
            endpoint, files=files, data=data, timeout=PDF_CONVERSION_TIMEOUT_SECONDS
        )
    except requests.Timeout as exc:
        raise PdfConversionError("PDF conversion timed out.") from exc
    except requests.RequestException as exc:
        raise PdfConversionError("Could not reach the PDF conversion service.") from exc

    if response.status_code != 200:
        raise PdfConversionError("The PDF conversion service failed to convert the document.")

    return response.content


def convert_docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Convert .docx bytes to PDF bytes via the Gotenberg conversion service."""
    return _convert([("files", ("sheet.docx", docx_bytes, DOCX_MIMETYPE))], {})


def merged_part_name(position: int) -> str:
    """Return the file name that keeps a binder part at ``position`` in Gotenberg's merge order.

    Gotenberg merges in file-name order, not upload order, so parts are named by
    their zero-padded position.
    """
    return f"{position:0{MERGED_PART_NAME_DIGITS}d}.docx"


def convert_docx_files_to_pdf(documents: Sequence[bytes]) -> bytes:
    """Convert several .docx documents into one PDF, in order, with a single Gotenberg request."""
    files: list[UploadPart] = [
        ("files", (merged_part_name(position), data, DOCX_MIMETYPE))
        for position, data in enumerate(documents, start=1)
    ]
    return _convert(files, {"merge": "true"})


@dataclass
class _ProbeCache:
    """The last answer from the PDF service's health endpoint and when it was taken."""

    checked_at: float | None = None
    status: str = "unknown"


_probe_cache = _ProbeCache()


def pdf_service_status() -> str:
    """Return ``"up"`` or ``"down"`` for the Gotenberg service, probing it at most every 30 s.

    The probe has a short timeout and the result is cached per process, so the
    application's own health check stays fast and never fails because the PDF
    service is unreachable; it only reports that PDF downloads will.
    """
    now = time.monotonic()
    checked_at = _probe_cache.checked_at
    if checked_at is not None and now - checked_at < PDF_HEALTH_CACHE_SECONDS:
        return _probe_cache.status
    try:
        response = requests.get(f"{_gotenberg_url()}/health", timeout=PDF_HEALTH_TIMEOUT_SECONDS)
        status = "up" if response.status_code == 200 else "down"
    except requests.RequestException:
        status = "down"
    _probe_cache.checked_at = now
    _probe_cache.status = status
    return status
