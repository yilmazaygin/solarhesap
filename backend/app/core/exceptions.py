# ./backend/app/core/exceptions.py
"""Application-wide exception hierarchy for Solar Hesap.

Each exception class maps to a specific HTTP status code.  The FastAPI
error-handler middleware (``app.core.error_handlers``) catches these
and returns the correct JSON error response automatically, so route
functions never need ``try / except`` blocks.

Hierarchy
---------
SolarHesapError (base)
├── ExternalAPIError            → 502 Bad Gateway
│   └── ExternalAPITimeoutError → 504 Gateway Timeout
├── ValidationError             → 400 Bad Request
└── SimulationError             → 500 Internal Server Error
"""

from __future__ import annotations


class SolarHesapError(Exception):
    """Base exception for every error raised by this application."""

    def __init__(self, message: str = "An internal error occurred.") -> None:
        self.message = message
        super().__init__(self.message)


class ExternalAPIError(SolarHesapError):
    """A third-party API (PVGIS, Open-Meteo) returned an error or was
    unreachable after all retry attempts.

    Maps to **HTTP 502 Bad Gateway**.
    """

    def __init__(self, service: str, message: str = "") -> None:
        self.service = service
        detail = f"{service} API error"
        if message:
            detail += f": {message}"
        super().__init__(detail)


class ExternalAPITimeoutError(ExternalAPIError):
    """A third-party API did not respond within the configured timeout.

    Maps to **HTTP 504 Gateway Timeout**.
    """

    def __init__(self, service: str, timeout_seconds: int | float = 0) -> None:
        self.timeout_seconds = timeout_seconds
        msg = f"timed out after {timeout_seconds}s"
        super().__init__(service, msg)


class ValidationError(SolarHesapError):
    """Business-logic validation failure (e.g. impossible coordinate,
    climatologically invalid parameter combination).

    Maps to **HTTP 400 Bad Request**.

    Note: Pydantic schema validation errors are handled separately by
    FastAPI and already return 422.  This class is for *post-schema*
    domain-level checks.
    """
    def __init__(self, message: str = "A validation error occurred.", context: str | None = None) -> None:
        self.context = context
        super().__init__(message)


class SimulationError(SolarHesapError):
    """An error occurred during the scientific simulation / modelling
    phase (PVLib, average-year, Bird, etc.).

    Maps to **HTTP 500 Internal Server Error**.
    """
