# Repository Guidelines

This repository is a Spring Boot backend (Java 17) organized around DDD-style modules. Use this guide to keep changes consistent and easy to review.

## Project Structure & Module Organization
- `src/main/java/com/notebook/learyAI`: application source.
- `config`: Spring configuration (CORS, Jackson, Redis, auth properties).
- `module/*`: bounded contexts, each with `application`, `domain`, `infrastructure`, `interfaces` layers (e.g., `auth`, `kb`, `kbdoc`).
- `shared`: cross-cutting APIs, context, and exceptions.
- `src/main/resources`: runtime configuration (`application.properties`, `application.yml`).
- `src/test`: test sources (currently empty). Mirror the main package structure.
- `target`: Maven build output (generated).

## Coding Style & Naming Conventions
- Java 17, 4-space indentation, no tabs (match existing files).
- Packages are all-lowercase (`com.notebook.learyAI`), classes `PascalCase`, methods/fields `camelCase`.
- Keep module boundaries clear: interfaces/controllers in `interfaces`, persistence adapters in `infrastructure`.
- No formatter or lint tool is configured; keep diffs tidy and small.

## Security & Configuration Tips
- `src/main/resources/application.properties` includes database, Redis, RabbitMQ, MinIO, and SMS settings. Avoid committing real secrets; prefer environment variables or profile-specific overrides for local dev.

## Observability
- API-level metrics use Spring Boot Actuator + Micrometer auto-instrumentation (`http.server.requests`), rather than per-endpoint manual counters by default.
- Metrics endpoint: `/actuator/prometheus` (intended for Prometheus scrape); keep this path unauthenticated in web auth filters.
- Base tags should include `application=learyAI` for cross-service dashboard aggregation in Grafana.

## Documentation Entry
- Root docs index: `docs/index.md`
- Cross-module references: `docs/refs/Architecture.md`, `docs/refs/Development.md`, `docs/refs/Testing.md`

## OpenAPI Contract
- Backend REST contract is exported from `/v3/api-docs` and persisted at repository root `schema/backend/openapi.json`.
- Do not hand-edit `schema/backend/openapi.json`; regenerate via `scripts/schema/gen_backend_schema_from_backend.sh`.
- OpenAPI export must pass module alignment checks in `scripts/schema/validate_backend_openapi.py`.
