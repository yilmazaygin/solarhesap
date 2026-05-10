# ./backend/app/create_app.py
"""FastAPI application factory.

Creates and configures the FastAPI instance, registers routers, and sets
up middleware.  Run with: ``uvicorn app.create_app:app --reload``
"""

import json
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import settings


def _parse_origins(raw: str) -> List[str]:
    raw = raw.strip()
    if not raw or raw == "[]":
        return []
    if raw.startswith("["):
        try:
            return [str(o) for o in json.loads(raw)]
        except (json.JSONDecodeError, ValueError):
            pass
    return [o.strip() for o in raw.split(",") if o.strip()]


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""

    is_dev = settings.APP_ENV == "development"

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=settings.APP_DESCRIPTION,
        docs_url="/docs" if is_dev else None,
        redoc_url="/redoc" if is_dev else None,
        openapi_url="/openapi.json" if is_dev else None,
    )

    # --- CORS middleware (allow frontend access) ---
    # allow_credentials=True is incompatible with allow_origins=["*"] per the CORS spec.
    # Backend is behind nginx and not directly exposed; wildcard is acceptable when
    # ALLOWED_ORIGINS is not configured, but credentials are never sent in that case.
    explicit_origins = _parse_origins(settings.ALLOWED_ORIGINS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=explicit_origins if explicit_origins else ["*"],
        allow_credentials=bool(explicit_origins),
        allow_methods=["GET", "POST", "OPTIONS"] if not is_dev else ["*"],
        allow_headers=["Content-Type", "Authorization"] if not is_dev else ["*"],
    )

    # --- Register custom error handlers ---
    from app.core.error_handlers import register_error_handlers
    register_error_handlers(app)

    # --- Register API routers ---
    from app.api.v1.solar_simulation_routes import router as solar_simulation_router
    from app.api.v1.solar_tools_routes import router as solar_tools_router

    app.include_router(solar_simulation_router, prefix="/api/v1")
    app.include_router(solar_tools_router, prefix="/api/v1")

    @app.get("/", tags=["Health"])
    def health_check():
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    return app


# Singleton for uvicorn
app = create_app()
