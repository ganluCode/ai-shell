.PHONY: dev build run clean

# Development: run frontend and backend in parallel
dev:
	@echo "Starting development servers..."
	@trap 'kill 0' INT; \
	(cd web && npm run dev) & \
	(cd api && uv run python -m llm_shell) & \
	wait

# Build: build frontend and copy to backend static directory
build:
	@echo "Building frontend..."
	cd web && npm install && npm run build
	@echo "Copying static files to backend..."
	rm -rf api/llm_shell/static
	cp -r web/dist api/llm_shell/static
	@echo "Build complete."

# Production: run backend only (assumes build has been run)
run:
	@echo "Starting production server..."
	cd api && uv run python -m llm_shell

# Clean: remove build artifacts
clean:
	rm -rf web/dist
	rm -rf api/llm_shell/static
	@echo "Clean complete."
