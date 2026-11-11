"""Errors raised by the transposition core."""


class InvalidKeyError(ValueError):
    """Raised when a supplied key string cannot be parsed."""


class PdfConversionError(RuntimeError):
    """Raised when a .docx cannot be converted to PDF."""
