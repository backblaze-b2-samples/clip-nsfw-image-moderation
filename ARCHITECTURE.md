<!-- last_verified: 2026-07-20 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with moderation stats and recent batches
  - **Batches** — the primary entity: create / read / edit / delete / run
  - **Bucket** — the raw full-bucket explorer (preview, download, delete)
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - Moderation-batch CRUD + the score/route/audit pipeline
  - On-device NSFW scoring engine (`app/moderation/`): CLIP + LAION classifier
  - B2 S3 integration via boto3 (staging, routing, quarantine, audit logs)
  - Health check endpoint with B2 connectivity verification
  - Structured JSON logging with request tracing; Prometheus-format `/metrics`
- **packages/shared/** — TypeScript type definitions mirroring the Pydantic models

## Backend Layering

```
types/       Pydantic models — no logic, no imports from other layers
  |
config/      Settings (pydantic-settings) — depends only on types
  |
repo/        Data access (boto3 B2 client) — no business logic
  |
service/     Business logic — calls repo, returns types
  |
runtime/     FastAPI routes — calls service, never repo directly

moderation/  On-device scoring engine (CLIP + LAION AutoKeras). Not a layer:
             works on raw bytes, imports config only, heavy ML imports deferred
             to call time. Invoked by service/moderation.py.
```

### Layering Rules

1. Dependencies flow downward only: `types -> config -> repo -> service -> runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (BatchSummary, BatchDetail, FileMetadata, ...)
    config/                Settings loaded from environment
    repo/                  B2 S3 client + object ops (b2_client.py, objects.py, counter.py)
    service/               Business logic (batches.py, moderation.py, files.py, upload.py)
    runtime/               FastAPI route handlers (batches.py, files.py, upload.py, ...)
    moderation/            On-device scorer (scorer.py, download_model.py)
  models/                  Cached LAION AutoKeras SavedModel (downloaded on first run)
  tests/                   pytest tests (structural + integration)
```

## B2 key layout

```
images/incoming/<batch-id>/<filename>       ingested images
images/approved/<batch-id>/<filename>        routed: score <  threshold
images/quarantine/<batch-id>/<filename>      routed: score >= threshold
moderation/logs/<batch-id>/manifest.json     durable batch record (name, threshold, per-image scores/verdicts)
moderation/logs/<batch-id>/results.jsonl     per-image {key, score, verdict}
moderation/logs/<batch-id>/summary.csv       batch totals + threshold + run ts
```

The batch record lives under `moderation/logs/` (not `images/incoming/`) so it
survives routing, which empties the incoming prefix. There is **no application
database** — B2 is the sole data store.

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other
  layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed
  Pydantic models.
- **Scoped deletes only**: `repo/objects.py::delete_prefix` refuses the empty
  prefix, and a batch delete only ever touches that batch's four prefixes —
  never a bucket-wide wildcard.
- **No cross-layer mutable state**: Intra-layer caches/counters are module-local
  and guarded by a `threading.Lock`.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. Batch ids
  are validated against a strict pattern to prevent path traversal in keys.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently` (web `:3000`,
  API `:8000`). NSFW scoring is `deployment: local` — CPU by default with
  CUDA → Apple MPS → CPU autodetect for the CLIP stage; the TensorFlow/AutoKeras
  classifier always runs on CPU. A GPU is never required.
- **Railway** — two services from the same repo; see `infra/railway/README.md`.

## External Services

- **Backblaze B2 S3 API** — storage, retrieval, routing (copy+delete), presigned URLs.
- **No third-party moderation API** — scoring is fully on-device. The only model
  fetch is a one-time download of LAION's SavedModel + the CLIP weights, cached
  locally.

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware`
  is registered LAST in `main.py` (outermost) so it wraps every response,
  including uncaught-exception 500s. A per-IP rate-limit middleware sits inner to CORS.
- **API -> B2** — authenticated via application keys, signature v4. Endpoint is
  derived from `B2_REGION` (no hardcoded region in source).
- **Client -> B2** — presigned URLs for image preview/download (short expiry).

## Data Flows

- **Create batch**: Browser -> `POST /batches` (multipart images + name +
  threshold) -> service ingests to `images/incoming/<id>/` + writes manifest.
- **Run batch**: Browser -> `POST /batches/{id}/run` -> service loads images
  from B2 -> `app.moderation.scorer.score_images` (CLIP + LAION) -> route each
  image (copy to approved/quarantine, delete source) -> write `results.jsonl` +
  `summary.csv` -> update manifest.
- **Read**: `GET /batches` (list) and `GET /batches/{id}` (detail) read manifests.
- **Edit**: `PATCH /batches/{id}` rewrites the manifest (name/threshold).
- **Delete**: `DELETE /batches/{id}` scoped-deletes the batch's four prefixes.
- **Bucket explorer**: `GET /files` -> full-bucket listing (unchanged starter path).

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format) and `/health` endpoint (B2 connectivity)

## Canonical Files

- Scoring engine: `services/api/app/moderation/scorer.py`
- Run pipeline: `services/api/app/service/moderation.py`
- Batch CRUD: `services/api/app/service/batches.py`
- Batch routes: `services/api/app/runtime/batches.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py` + `objects.py`
- Pydantic models: `services/api/app/types/` (`batches.py`, `files.py`, ...)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Moderation Batches](docs/features/moderation-batches.md)
- [NSFW Scoring](docs/features/nsfw-scoring.md)
- [Routing & Quarantine](docs/features/routing-quarantine.md)
- [Audit Logs](docs/features/audit-logs.md)
- [Dashboard](docs/features/dashboard.md)
- [File Browser](docs/features/file-browser.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
