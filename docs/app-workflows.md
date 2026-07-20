<!-- last_verified: 2026-07-20 -->
# App Workflows

User journeys inside the application.

## Create a Moderation Batch

- User navigates to `/batches/new`
- Enters a batch name (placeholder suggests e.g. `ugc-batch-2026-07-20`)
- Picks a **safety threshold** from a selector — Strict (0.50), Balanced (0.70,
  default), or Lenient (0.90). A description explains that an image is
  quarantined when its score is `>= threshold`
- Drops or selects images (JPEG/PNG/GIF/WebP) into the dropzone
- On submit, images are ingested to `images/incoming/<batch-id>/` with a manifest
  and the user lands on the batch detail page
- See: [Moderation Batches](features/moderation-batches.md)

## Run a Batch (score → route → audit)

- On `/batches/[id]`, user clicks **Run scoring**
- While it runs, the button shows a spinner + "Scoring on-device…" with a helper
  line (the first run loads the model, ~30s, so a pass can take 15–45s), and the
  Summary status badge shows a spinning "running" state — so a long wait reads as
  "working", not "hung"
- The API loads every image from B2, scores it on-device (CLIP + LAION), then
  routes it: safe → `images/approved/<id>/`, flagged → `images/quarantine/<id>/`
  (copy-then-delete; incoming originals removed after routing)
- Per-image `results.jsonl` and a batch `summary.csv` are written under
  `moderation/logs/<id>/`
- The detail view refreshes with per-image score, verdict badge, and thumbnail;
  a toast reports totals
- The **Audit log** panel on the detail page lists this batch's log files
  (`results.jsonl`, `summary.csv`, `manifest.json`) with per-file Download
  buttons — a direct in-app path to the logs without opening the raw bucket
  explorer
- Re-running after editing the threshold re-routes with the new cutoff
- See: [NSFW Scoring](features/nsfw-scoring.md), [Routing & Quarantine](features/routing-quarantine.md), [Audit Logs](features/audit-logs.md)

## Edit / Delete a Batch

- **Edit**: `/batches/[id]/edit` opens pre-filled with the batch's name and
  current threshold. Saving issues `PATCH /batches/{id}`
- **Delete**: from the batch detail action panel, a confirm dialog runs a scoped
  delete that removes only this batch's four prefixes (incoming, approved,
  quarantine, logs) — never other batches' data

## Browse Batches

- User navigates to `/batches`
- Table lists every batch: name, status, image count, threshold, approved vs.
  quarantined counts, created date. Row links to the detail page
- Empty state offers a "New batch" action

## Inspect the Raw Bucket

- User navigates to `/files` (the "Bucket" explorer)
- Full-bucket tree view across every prefix the pipeline produces
  (`images/**`, `moderation/**`), with preview / download / delete per object
- Useful for verifying the exact object layout the pipeline writes
- See: [File Browser](features/file-browser.md)

## View Dashboard

- User navigates to `/` (home)
- Stats cards show: total batches, images scored, approved, quarantined
- Recent batches table shows the most recent batches with status and image count
- Empty state: "No batches yet"
- See: [Dashboard](features/dashboard.md)
