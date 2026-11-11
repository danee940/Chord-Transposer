"""Conversion of .docx bytes to PDF through the Gotenberg service."""

import os

import requests

from .errors import PdfConversionError

DEFAULT_GOTENBERG_URL = "http://localhost:3000"
PDF_CONVERSION_TIMEOUT_SECONDS = 120


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
