# ./backend/app/create_app.py
"""FastAPI application factory.

Creates and configures the FastAPI instance, registers routers, and sets
up middleware.  Run with: ``uvicorn app.create_app:app --reload``
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import settings


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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
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
