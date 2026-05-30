# ./backend/app/core/error_handlers.py
"""FastAPI exception-handler middleware for Solar Hesap.

Registers ``@app.exception_handler`` hooks so that custom exceptions
raised anywhere in the service layer are automatically translated into
proper JSON error responses with the correct HTTP status code.

Usage
-----
Call ``register_error_handlers(app)`` once inside ``create_app()``.
After that, route functions can simply call service code without any
``try / except`` — the middleware handles everything.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.logger import alogger
from app.core.exceptions import (
    SolarHesapError,
    ExternalAPIError,
    ExternalAPITimeoutError,
    ValidationError,
    SimulationError,
)


def register_error_handlers(app: FastAPI) -> None:
    """Attach all custom exception handlers to the FastAPI application."""

    # --- 504 Gateway Timeout (must be registered before 502) ---
    @app.exception_handler(ExternalAPITimeoutError)
    async def _handle_api_timeout(
        request: Request, exc: ExternalAPITimeoutError
    ) -> JSONResponse:
        alogger.warning(
            "External API timeout: %s (path=%s)", exc.message, request.url.path
        )
        return JSONResponse(
            status_code=504,
            content={
                "error": "gateway_timeout",
                "detail": exc.message,
                "service": exc.service,
            },
        )

    # --- 502 Bad Gateway ---
    @app.exception_handler(ExternalAPIError)
    async def _handle_api_error(
        request: Request, exc: ExternalAPIError
    ) -> JSONResponse:
        alogger.error(
            "External API error: %s (path=%s)", exc.message, request.url.path
        )
        return JSONResponse(
            status_code=502,
            content={
                "error": "bad_gateway",
                "detail": exc.message,
                "service": exc.service,
            },
        )

    # --- 400 Bad Request ---
    @app.exception_handler(ValidationError)
    async def _handle_validation(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        alogger.warning(
            "Validation error: %s (path=%s)", exc.message, request.url.path
        )
        return JSONResponse(
            status_code=400,
            content={
                "error": "bad_request",
                "detail": exc.message,
            },
        )

    # --- 500 Internal Server Error (simulation) ---
    @app.exception_handler(SimulationError)
    async def _handle_simulation(
        request: Request, exc: SimulationError
    ) -> JSONResponse:
        alogger.error(
            "Simulation error: %s (path=%s)", exc.message, request.url.path
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "simulation_error",
                "detail": exc.message,
            },
        )

    # --- Catch-all for any SolarHesapError subclass we forgot ---
    @app.exception_handler(SolarHesapError)
    async def _handle_base(
        request: Request, exc: SolarHesapError
    ) -> JSONResponse:
        alogger.error(
            "Unhandled SolarHesapError: %s (path=%s)", exc.message, request.url.path
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "detail": exc.message,
            },
        )

    alogger.info("Custom error handlers registered successfully")
