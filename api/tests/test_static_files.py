"""Tests for static file hosting and SPA fallback."""

from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


class TestStaticFilesPattern:
    """Tests for static file serving pattern."""

    def test_api_routes_still_work(self, client: TestClient) -> None:
        """API routes should continue to work after static file mount."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_api_servers_route_works(self, client: TestClient) -> None:
        """API servers route should work."""
        response = client.get("/api/servers")
        assert response.status_code == 200

    def test_non_api_route_returns_spa_fallback(self, tmp_path: Path) -> None:
        """Non-API routes should return index.html for SPA routing."""
        # Create a mock static directory with index.html
        static_dir = tmp_path / "static"
        static_dir.mkdir()

        index_html = static_dir / "index.html"
        index_html.write_text("<html><body>SPA App</body></html>")

        # Create a test app with static files mounted and SPA fallback
        from fastapi import FastAPI, Request
        from fastapi.responses import FileResponse
        from fastapi.staticfiles import StaticFiles

        app = FastAPI()

        @app.get("/api/test")
        def api_test() -> dict[str, str]:
            return {"status": "ok"}

        # SPA fallback route - catch all non-API routes
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(request: Request, full_path: str) -> FileResponse:
            return FileResponse(str(static_dir / "index.html"))

        # Mount static files
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

        test_client = TestClient(app)

        # Request a non-API, non-file route
        response = test_client.get("/some/spa/route")
        # Should return index.html (200) instead of 404
        assert response.status_code == 200
        assert "SPA App" in response.text

    def test_static_file_served_correctly(self, tmp_path: Path) -> None:
        """Static files should be served from the static directory."""
        # Create a mock static directory with a file
        static_dir = tmp_path / "static"
        static_dir.mkdir()

        test_js = static_dir / "test.js"
        test_js.write_text("console.log('test');")

        # Create a test app with static files mounted
        from fastapi import FastAPI
        from fastapi.staticfiles import StaticFiles

        app = FastAPI()

        @app.get("/api/test")
        def api_test() -> dict[str, str]:
            return {"status": "ok"}

        # Mount static files
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

        test_client = TestClient(app)

        # Request a static file
        response = test_client.get("/test.js")
        assert response.status_code == 200
        assert "console.log" in response.text

    def test_api_routes_not_shadowed_by_static(self, tmp_path: Path) -> None:
        """API routes should not be shadowed by static file mount."""
        # Create a mock static directory
        static_dir = tmp_path / "static"
        static_dir.mkdir()

        api_dir = static_dir / "api"
        api_dir.mkdir()
        (api_dir / "servers.txt").write_text("Should not be served")

        # Create a test app with static files mounted
        from fastapi import FastAPI
        from fastapi.staticfiles import StaticFiles

        app = FastAPI()

        @app.get("/api/servers")
        def get_servers() -> list[dict[str, str]]:
            return [{"id": "1", "name": "test"}]

        # Mount static files AFTER API routes
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

        test_client = TestClient(app)

        # API route should still work
        response = test_client.get("/api/servers")
        assert response.status_code == 200
        assert response.json() == [{"id": "1", "name": "test"}]
