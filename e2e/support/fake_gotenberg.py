"""Stand-in for the Gotenberg PDF service used by the end-to-end tests.

It answers ``POST /forms/libreoffice/convert`` with a PDF that shows the
paragraphs of each uploaded .docx as text lines, one page per document, so
tests can assert that the transposed documents are what reached the converter.
Like Gotenberg, several documents are only combined when the ``merge`` field is
sent, and the pages are ordered by *file name*, not upload order, so the
binder's zero-padded part names are exercised. A document containing a
paragraph equal to the failure marker is rejected, as a failed conversion.

Usage: ``python e2e/support/fake_gotenberg.py <port> <failure-marker>``
"""

import sys
from email.parser import BytesParser
from email.policy import default as default_policy
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from typing import NamedTuple

from docx import Document

CONVERT_PATH = "/forms/libreoffice/convert"
HEALTH_PATH = "/health"
PAGE_TOP = 760
LINE_HEIGHT = 14


def pdf_string(text: str) -> bytes:
    """Encode text as a PDF literal string in the standard Latin-1 font encoding."""
    escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return b"(" + escaped.encode("latin-1", errors="replace") + b")"


def text_pdf(pages: list[list[str]]) -> bytes:
    """Build an uncompressed PDF with one page per list of lines, shown as Helvetica text."""
    objects: list[bytes] = [
        b"",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    page_numbers: list[int] = []
    for lines in pages:
        content = b"BT /F1 10 Tf %d TL 50 %d Td " % (LINE_HEIGHT, PAGE_TOP)
        content += b"".join(pdf_string(line) + b" ' " for line in lines) + b"ET"
        page_number = len(objects) + 1
        page_numbers.append(page_number)
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>" % (page_number + 1)
        )
        objects.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content))
    kids = b" ".join(b"%d 0 R" % number for number in page_numbers)
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(pages))

    body = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body += b"%d 0 obj\n%s\nendobj\n" % (number, obj)
    xref_offset = len(body)
    body += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    body += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    body += b"trailer\n<< /Size %d /Root 1 0 R >>\n" % (len(objects) + 1)
    body += b"startxref\n%d\n%%%%EOF\n" % xref_offset
    return bytes(body)


class ConversionRequest(NamedTuple):
    """The documents and form fields of a multipart conversion request."""

    documents: list[tuple[str, bytes]]
    merge: bool


def parse_request(content_type: str, body: bytes) -> ConversionRequest:
    """Return the ``files`` parts as (file name, bytes) and whether ``merge`` was requested."""
    envelope = b"Content-Type: " + content_type.encode("latin-1") + b"\r\n\r\n" + body
    message = BytesParser(policy=default_policy).parsebytes(envelope)
    documents: list[tuple[str, bytes]] = []
    merge = False
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        payload = part.get_payload(decode=True)
        if not isinstance(payload, bytes):
            continue
        if name == "files":
            documents.append((part.get_filename() or "", payload))
        elif name == "merge":
            merge = payload.strip().lower() == b"true"
    return ConversionRequest(documents, merge)


def docx_lines(docx_bytes: bytes) -> list[str]:
    """Return the body paragraph texts of a .docx document."""
    return [paragraph.text for paragraph in Document(BytesIO(docx_bytes)).paragraphs]


def handler_for(failure_marker: str) -> type[BaseHTTPRequestHandler]:
    """Return a request handler that fails conversions containing ``failure_marker``."""

    class FakeGotenbergHandler(BaseHTTPRequestHandler):
        """Serve the health check and the LibreOffice conversion route."""

        def do_GET(self) -> None:
            if self.path == HEALTH_PATH:
                self.respond(HTTPStatus.OK, "text/plain", b"ok")
            else:
                self.respond(HTTPStatus.NOT_FOUND, "text/plain", b"not found")

        def do_POST(self) -> None:
            if self.path != CONVERT_PATH:
                self.respond(HTTPStatus.NOT_FOUND, "text/plain", b"not found")
                return
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            request = parse_request(self.headers.get("Content-Type", ""), body)
            if not request.documents:
                self.respond(HTTPStatus.BAD_REQUEST, "text/plain", b"missing files part")
                return
            if len(request.documents) > 1 and not request.merge:
                self.respond(HTTPStatus.BAD_REQUEST, "text/plain", b"several files need merge=true")
                return
            ordered = sorted(request.documents, key=lambda document: document[0])
            pages = [docx_lines(docx_bytes) for _, docx_bytes in ordered]
            if any(failure_marker in lines for lines in pages):
                self.respond(HTTPStatus.INTERNAL_SERVER_ERROR, "text/plain", b"conversion failed")
                return
            self.respond(HTTPStatus.OK, "application/pdf", text_pdf(pages))

        def respond(self, status: HTTPStatus, content_type: str, body: bytes) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: object) -> None:
            return

    return FakeGotenbergHandler


def main() -> None:
    port, failure_marker = int(sys.argv[1]), sys.argv[2]
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(failure_marker))
    server.serve_forever()


if __name__ == "__main__":
    main()
