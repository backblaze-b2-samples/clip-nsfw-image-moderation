<!-- last_verified: 2026-07-20 -->
# Feature: Audit Logs

## Purpose
Persist a per-image and per-batch record of every moderation run to B2 for
compliance review.

## Used By
- API: written inside `POST /batches/{id}/run`
- Job: `services/api/app/service/moderation.py::_write_audit`

## Core Functions
- `services/api/app/service/moderation.py` — `_write_audit()`
- `services/api/app/repo/objects.py` — `put_bytes()`

## Canonical Files
- Audit writer: `services/api/app/service/moderation.py`

## Inputs
- The batch manifest (with per-image scores/verdicts), threshold, run timestamp, totals

## Outputs
- `moderation/logs/<id>/results.jsonl` — one JSON object per scored image: `{ key, filename, score, verdict }`
- `moderation/logs/<id>/summary.csv` — header + one totals row: `batch_id, name, threshold, run_at, total, approved, quarantined`
- `moderation/logs/<id>/manifest.json` — durable batch record (survives routing)

## Flow
- After routing, serialize every scored image to `results.jsonl`
- Write a one-row `summary.csv` with batch totals + threshold + run timestamp
- Update the manifest (status, last_run_at, approved/quarantined counts) and persist it

## Edge Cases
- Re-run overwrites `results.jsonl` and `summary.csv` with the latest verdicts
- The manifest lives under `moderation/logs/` (not `images/incoming/`) so it survives
  routing, which empties the incoming prefix
- Quarantined images are retained under `images/quarantine/` alongside the logs

## UX States
- The run toast reports totals; the detail page's summary card shows approved/quarantined and last-run time

## Verification
- Test files: `services/api/tests/test_batches.py` (`test_run_routes_by_threshold` asserts manifest/status updates)
- Required cases: results + summary written, manifest updated
- Quick verify command: `pnpm test:api`
- Full verify command: run a batch, download `moderation/logs/<id>/summary.csv` from the bucket explorer and confirm totals
- Pass criteria: audit artifacts present and consistent with the run result

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Routing & Quarantine](routing-quarantine.md), [Moderation Batches](moderation-batches.md)
