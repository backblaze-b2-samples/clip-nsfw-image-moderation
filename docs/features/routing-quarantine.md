<!-- last_verified: 2026-07-20 -->
# Feature: Routing & Quarantine

## Purpose
After scoring, route each image to an approved or quarantine prefix on B2 and
remove the incoming original — so downstream systems can trust the prefix.

## Used By
- API: inside `POST /batches/{id}/run`
- Job: `services/api/app/service/moderation.py::run_batch`

## Core Functions
- `services/api/app/service/moderation.py` — `_target_key()`, routing loop in `run_batch`
- `services/api/app/repo/objects.py` — `copy_object()`, `delete_prefix()`, `get_object_bytes()`, `put_bytes()`

## Canonical Files
- Run pipeline: `services/api/app/service/moderation.py`
- Object ops (repo): `services/api/app/repo/objects.py`

## Inputs
- Per-image score (0..1) and the batch threshold

## Outputs
- Objects copied to `images/approved/<id>/<filename>` (score < threshold) or
  `images/quarantine/<id>/<filename>` (score >= threshold)
- Incoming originals deleted after a successful copy
- Manifest per-image `key`/`verdict` updated

## Flow
- For each image: `verdict = quarantine if score >= threshold else approved`
- Compute target key; if it differs from the current key, `copy_object` then
  `delete_file` the source (B2 has no server-side move — routing is copy-then-delete)
- Re-running with a changed threshold re-routes images between approved/quarantine

## Edge Cases
- Image missing at run time (deleted externally) → skipped with a warning, run continues
- Copy failure → RuntimeError → the run endpoint returns 500
- Scoped deletes only: a batch delete touches exactly its four prefixes via
  `delete_prefix`, which refuses the empty prefix — never a bucket-wide wildcard

## UX States
- Verdict badges on the detail page: green "approved", red "quarantine"; quarantined
  thumbnails get a red ring. Quarantined images are retained for human review.

## Verification
- Test files: `services/api/tests/test_batches.py` (`test_run_routes_by_threshold`, `test_delete_batch_only_touches_its_prefixes`)
- Required cases: safe→approved, flagged→quarantine, scoped delete
- Quick verify command: `pnpm test:api`
- Full verify command: run a batch, confirm objects moved to approved/quarantine and incoming emptied on B2
- Pass criteria: routed objects present at expected keys; no cross-batch deletion

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [NSFW Scoring](nsfw-scoring.md), [Audit Logs](audit-logs.md)
