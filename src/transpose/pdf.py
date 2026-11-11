"""Conversion of .docx bytes to PDF through the Gotenberg service."""

import os
import time
from dataclasses import dataclass

import requests

from .errors import PdfConversionError

DEFAULT_GOTENBERG_URL = "http://localhost:3000"
PDF_CONVERSION_TIMEOUT_SECONDS = 120
PDF_HEALTH_TIMEOUT_SECONDS = 2
PDF_HEALTH_CACHE_SECONDS = 30


def _gotenberg_url() -> str:
    """Return the base URL of the Gotenberg conversion service."""
    return (os.environ.get("GOTENBERG_URL") or DEFAULT_GOTENBERG_URL).rstrip("/")


def convert_docx_to_pdf(docx_bytes: bytes) -> bytes:
    """Convert .docx bytes to PDF bytes via the Gotenberg conversion service."""
    endpoint = f"{_gotenberg_url()}/forms/libreoffice/convert"
    files = {
        "files": (
            "sheet.docx",
            docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }

    try:
        response = requests.post(endpoint, files=files, timeout=PDF_CONVERSION_TIMEOUT_SECONDS)
    except requests.Timeout as exc:
        raise PdfConversionError("PDF conversion timed out.") from exc
    except requests.RequestException as exc:
        raise PdfConversionError("Could not reach the PDF conversion service.") from exc

    if response.status_code != 200:
        raise PdfConversionError("The PDF conversion service failed to convert the document.")

    return response.content


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
