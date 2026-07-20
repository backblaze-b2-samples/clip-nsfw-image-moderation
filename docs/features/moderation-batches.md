<!-- last_verified: 2026-07-20 -->
# Feature: Moderation Batches

## Purpose
The primary entity — a named set of images ingested to B2, scored on-device, and
routed to approved/quarantine. Exposes all five lifecycle verbs in the UI.

## Used By
- UI: `/batches` (list), `/batches/new` (create), `/batches/[id]` (detail/read +
  run/delete), `/batches/[id]/edit` (edit)
- API: `GET /batches`, `GET /batches/stats`, `GET /batches/{id}`, `POST /batches`,
  `PATCH /batches/{id}`, `DELETE /batches/{id}`, `POST /batches/{id}/run`

## Core Functions
- `apps/web/src/components/batches/batch-form.tsx` — create + edit form (Select threshold + dropzone)
- `apps/web/src/components/batches/batch-table.tsx` — list
- `apps/web/src/components/batches/batch-detail.tsx` — per-image scores + thumbnails
- `apps/web/src/components/batches/run-panel.tsx` — run / edit / delete actions
- `services/api/app/service/batches.py` — CRUD + manifest helpers + stats
- `services/api/app/runtime/batches.py` — HTTP handlers

## Canonical Files
- Form UX exemplar: `apps/web/src/components/settings/settings-form.tsx`
- Batch CRUD: `services/api/app/service/batches.py`

## Inputs
- name: string (2–80 chars)
- threshold: finite preset — Strict (0.50) / Balanced (0.70, default) / Lenient (0.90)
- files: image/jpeg|png|gif|webp, ≤ 25MB each (create only)

## Outputs
- `POST /batches` → `BatchCreateResult`; writes `images/incoming/<id>/*` + `moderation/logs/<id>/manifest.json`
- `GET /batches` → `BatchSummary[]`; `GET /batches/{id}` → `BatchDetail`
- `PATCH /batches/{id}` → `BatchSummary` (rewrites manifest name/threshold)
- `DELETE /batches/{id}` → `{ deleted, id, objects_removed }` (scoped to the batch's four prefixes)
- Side effects: B2 object writes/copies/deletes; manifest updates

## Flow
- Create → ingest images + manifest → detail page
- Run → score + route + audit (see [NSFW Scoring](nsfw-scoring.md), [Routing & Quarantine](routing-quarantine.md))
- Edit → change name/threshold; a new threshold re-routes on the next run
- Delete → scoped removal of incoming/approved/quarantine/logs for that id only

## Edge Cases
- Empty image set on create → 400
- Non-image content type → 415
- Unknown / malformed batch id → 404 / 400 (id validated against a strict pattern)
- Deleting a batch never touches other batches' prefixes (no bucket-wide wildcard)

## UX States
- Empty: "No moderation batches yet" with a New batch action
- Loading: skeleton rows / cards
- Error: inline error state with retry

## Verification
- Test files: `services/api/tests/test_batches.py`
- Required cases: create ingests + manifest, scoped delete, threshold routing, update, id validation
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm test:web && pnpm build && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all tests green, no lint violations, all five verbs reachable in the UI

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
- [NSFW Scoring](nsfw-scoring.md), [Routing & Quarantine](routing-quarantine.md), [Audit Logs](audit-logs.md)
