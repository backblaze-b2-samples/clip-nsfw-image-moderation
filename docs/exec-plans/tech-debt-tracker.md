<!-- last_verified: 2026-07-15 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

## Open

| Description | Impact | Proposed Resolution | Priority |
|---|---|---|---|
| TensorFlow 2.15 + AutoKeras load path is fragile on macOS arm64 | The LAION classifier load can hang/fail in-process on some arm64 wheels; scoring is unavailable when it does | Fall back to a native `linux/arm64` container for the scorer (as done for prior paddleocr/deoldify samples); keep the pinned known-good versions in `requirements.txt` | Medium |
| Batch run is synchronous (blocks the request until scoring completes) | Large batches hold a request/threadpool slot for the whole run | Move `run_batch` to a background task/queue and poll status; the manifest already tracks status | Medium |
| Download counter & `/metrics` not durable across restart/replicas | Counter resets on redeploy (ephemeral FS); both fragment across replicas | Back the counter with a shared store (Redis/DB); label/aggregate metrics per instance. Relocated to `repo/counter.py` and documented in RELIABILITY.md | Medium |
| Upload buffers the whole file in memory | ~3× file size RAM per upload; large files strain the server (event loop no longer blocked, but memory unbounded) | Stream to a temp file, or S3 multipart above a size threshold | Medium |
| `get_upload_activity` re-materializes `FileMetadata` for every object just to bucket dates | Wasted O(n) CPU per `/files/stats/activity` (scan is cached; materialization is not) | Aggregate from raw listing dicts like `get_upload_stats` does | Low |
| Frontend has no component/render tests; e2e only checks routing | UI states (loading/error/empty) and the real upload→delete journey are unverified | Add jsdom + @testing-library/react render tests; a fixture-driven upload e2e | Medium |
| Allowed file types hardcoded in `service/upload.py` | Reuse friction — each new app edits source to change accepted types | Make `ALLOWED_TYPES` / `MIME_EXTENSION_MAP` env-configurable | Low |
| No auth layer or placeholder | Every consumer designs auth from scratch; unclear where it plugs in | Add example middleware (API-key or JWT) + docs for the seam | Low |
| No `docker-compose.yaml` | Manual venv + dual-process startup slows first run | Add compose with `web` + `api` services and Dockerfiles | Low |
| `api-client.ts` hand-synced to FastAPI | Endpoint drift between client and server | Note an OpenAPI codegen strategy or link the spec | Low |
| No dedicated connection-status banner | Offline only surfaced reactively per failed query | Add a global connectivity banner (route + global error boundaries already exist) | Low |

## Resolved

| Description | Resolution |
|---|---|
| Blocking boto3 in `async def` handlers froze the single event loop | B2 handlers are sync `def` (Starlette threadpool); upload offloads via `run_in_threadpool` |
| Full-bucket scan on every list/stats/activity request, uncached | Short-TTL cache in `repo/b2_client._list_all_objects`, invalidated on upload/delete |
| No CI — quality gates ran only when a human remembered | `.github/workflows/ci.yml` runs web + API gates on PR and push to `main` |
| SVG stored-XSS; declared MIME trusted; unused `python-magic` dep | Dropped SVG from allow-list; added magic-byte signature check; removed dead `python-magic` |
| No rate limiting → DoS + B2 cost amplification | Per-IP fixed-window limiter (`runtime/ratelimit.py`), read/write budgets |
| Counter persistence lived in the service layer (layering violation) | Moved file I/O to `repo/counter.py` behind `get/increment_download_count` |
| CORS `allow_credentials=True` with no auth + regex escape hatch | Default `allow_credentials=False`; empty origins filtered |
| No security headers on API responses | `X-Content-Type-Options: nosniff` + `Referrer-Policy: no-referrer` on every response |
| Key-addressed ops could target any bucket object | Opt-in `ALLOWED_KEY_PREFIX` confinement (off by default, preserves arbitrary-key routes) |
| Redundant triple-scan + double sort per dashboard mount | TTL cache + single-flight collapse the concurrent empty-prefix scans; dropped the repo-layer sort so `get_files` owns newest-first ordering once |
| Unguarded `int(content-length)`; public `/docs`; uncached `/health` B2 call | Content-Length parse guarded; `ENABLE_DOCS` toggle; connectivity cached ~5s |
| Upload validation sad-paths (413/415) + sanitizer untested | `tests/test_upload_validation.py` covers the rejection matrix, signature, `uploads_total` |
| FastAPI `/docs` & `/redoc` undocumented | Documented in README; `ENABLE_DOCS` toggle added |
| `NEXT_PUBLIC_API_URL` missing from `.env.example` | Added with guidance |
| `get_upload_stats()` / `list_files()` object listing capped at 1000 | Shared `_list_all_objects()` paginator follows `ContinuationToken` |
| `datetime.utcnow()` deprecated in Python 3.12+ | Replaced with `datetime.now(UTC)` |
| S3 client recreated on every API call | Cached module-level singleton via `lru_cache` |
| `record_upload()` never called | Called from `runtime/upload.py` after upload |
| Metrics counters not thread-safe | Guarded by `threading.Lock` |
| `_humanize_bytes` duplicated in Python | Extracted to `app/types/formatting.py` |
| `humanizeBytes` / `formatDate` duplicated in TypeScript | Extracted to `lib/utils.ts` (tested) |
| Custom `FileNotFoundError` shadowed the built-in | Renamed to `FileNotFoundServiceError` |
| Dropzone accepted any file type client-side | `accept` allow-list mirroring backend `ALLOWED_TYPES` (tested for drift) |
| No test harness for feature specs | pytest suite across upload, files, activity, errors, validation, rate limit, pagination |

## 2026-07-20 — verify (UX nitpicks, gate-demoted)

Surviving nitpicks from an autonomous UI verify run (3-lens funnel). Backlog only — none block the moderation goal, which was verified end-to-end (default Balanced 0.70 all-approved + non-default Strict 0.50 approved/quarantine split, cross-surface agreement, real media painted).

- Batch detail → Audit log panel — files (`results.jsonl` / `summary.csv` / `manifest.json`) are Download-only → no inline/expandable preview in-app; a user must download + open elsewhere to read the audit trail. Per-image verdicts are shown inline, so the intent is covered. (shot `.local/verify/r2A/07-results-routing-audit.png`)
- Batch detail → "Run scoring" in-progress — has an animated spinner + a "running" badge + honest ETA text, but no determinate/advancing progress bar on the ~30s wait (dominated by one-time model load). A determinate bar or per-image step counter would be nicer (an adversarial gate demoted this from friction → nitpick). (shot `.local/verify/r2B/06-scoring-in-progress.png`)
- Batch detail immediately after create — 4/6 preview thumbnails render blank for ~2s (presigned-URL load timing) with a few transient browser-console 404s while objects move `incoming/ → approved/quarantine/` (copy-then-delete); self-heals once scoring completes, no API-log errors. (shot `.local/verify/A/04-batch-created-detail.png`)

## 2026-07-20 — verify (correction to an Open item)

- The Open item "TensorFlow 2.15 + AutoKeras load path is fragile on macOS arm64" was verified this run: scoring runs **in-process on macOS arm64 (MPS)** with no native hang. The actual fresh-install failure was an **unpinned `keras-nlp`/`keras-hub`** resolving to 0.18.x (Keras-3 `keras.ops`) and crashing `import autokeras` under the Keras-2.15 that TF 2.15 ships — now fixed by pinning `keras-nlp>=0.7.0,<0.8` in `requirements.txt`. The container fallback is no longer required on this arch/wheel line; keep the item only as a portability contingency for other arm64 wheels.
