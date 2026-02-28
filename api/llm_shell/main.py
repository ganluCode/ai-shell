"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from llm_shell.config import get_settings
from llm_shell.db.database import close_database, get_database
from llm_shell.exceptions import AppError


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler."""
    # Startup: connect to database
    await get_database()
    yield
    # Shutdown: close database
    await close_database()


app = FastAPI(
    title="LLM Shell API",
    description="AI-assisted SSH client backend",
    version="0.1.0",
    lifespan=lifespan,
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle application errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
    )

# CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# Include routers
from llm_shell.api import groups, keypairs, servers  # noqa: E402
from llm_shell.api import settings as settings_api

app.include_router(groups.router, prefix="/api", tags=["groups"])
app.include_router(keypairs.router, prefix="/api", tags=["keypairs"])
app.include_router(servers.router, prefix="/api", tags=["servers"])
app.include_router(settings_api.router, prefix="/api", tags=["settings"])
