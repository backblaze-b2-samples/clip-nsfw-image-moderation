# Build plan — `clip-nsfw-image-moderation`

Source of truth for the starter tree: `.claude/scratch/vcsk-90acb06f-d7c6-402d-bb2d-dbc39440d81b/`
(cloned fresh in Phase 0). All keep/trim/add deltas are computed against that tree.

## 1. Purpose

`clip-nsfw-image-moderation` is a self-hosted, local content-moderation pipeline for
UGC platforms, social networks, and dataset marketplaces that ingest large volumes of
user-submitted or crawled images. It uses **LAION-AI's CLIP-based NSFW Detector** —
CLIP (ViT-L/14) image embeddings fed into LAION's trained AutoKeras safety classifier —
to score every image 0–1 (1 = NSFW) **entirely on-device**, so image bytes never leave
the operator's infrastructure for a third-party moderation API. Backblaze B2 is the
staging, routing, quarantine, and audit-log store for the whole pipeline: images land in
`images/incoming/<batch-id>/`, get scored, then are routed to `images/approved/<batch-id>/`
or `images/quarantine/<batch-id>/`, with per-image score logs and batch summary CSVs
persisted under `moderation/logs/<batch-id>/` for compliance review. It's for trust-&-safety
and ML-data engineers who need bulk NSFW triage with no second API key — B2 credentials only.

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit (Next.js `apps/web` + FastAPI `services/api`, B2 via boto3 S3 client) is the
ceiling. Strip what a moderation pipeline doesn't need; keep the whole B2/S3 plumbing, the
design system, and the dashboard/settings shells.

### keep (as-is or near-as-is)
- **`services/api/app/repo/b2_client.py`** — the S3 client, listing cache, presign, pagination.
  Extend it (copy/route helpers) but keep the caching/single-flight core.
- **`apps/web/src/app/files/` + `components/files/*`** — the **full-bucket explorer**. This is the
  starter's bucket browser and is **NEVER removable** (skill hard rule). Keep it as the raw
  "Bucket" view so a user can inspect every object across all prefixes. (See note in §Key features
  about the *added* scoped explorer.)
- Design system (`app/design`, `components/design/*`, `globals.css`, all `components/ui/*`).
- Layout shell (`app-sidebar`, `header`, `theme-provider`, `command-palette`, `health-banner`).
  `header.tsx` already derives its title from `APP_NAME` + pathname (no hardcoded brand string).
- `settings/settings-form.tsx` + `settings/danger-zone.tsx` — reused as the settings shell and as
  the **form-UX exemplar** (Select/RadioGroup + FormDescription defaults) for the new batch forms.
- Backend runtime scaffolding: `health.py`, `metrics.py`, `ratelimit.py`, structured logging,
  CORS/middleware ordering in `main.py`, `types/*`, `config/settings.py` shape, test harness
  (`tests/conftest.py` + structural tests).
- `upload` components (`dropzone`, `upload-form`, `upload-progress`) — reused *inside* the New
  Batch flow (not as a standalone generic upload page; see trim).

### trim (remove from starter)
- Standalone **`app/upload/page.tsx`** as a generic "upload any file to any key" page — folds into
  the batch-create flow (`/batches/new`). Its child components are reused, the route is removed and
  the dashboard's "Upload files" button is rewired to `/batches/new`.
- **`app/service/metadata.py` + `runtime`/metadata-extraction docs** as a headline feature —
  image EXIF/metadata extraction isn't this app's point. Keep only if trivially inert; otherwise
  drop the metadata feature doc and any nav/UI referencing it. (PyPDF2 dep dropped — no PDFs here.)
- `docs/features/file-upload.md`, `docs/features/metadata-extraction.md` — deleted/rewritten (see §5).
- Sample data / placeholder copy that names "OSS Starter Kit".

### add (new for clip-nsfw-image-moderation)
- **Scoring engine** `services/api/app/moderation/scorer.py` — lazy-singleton loader for CLIP
  (open_clip ViT-L/14) + LAION AutoKeras classifier; `score_images(list[bytes]) -> list[float]`.
  Device autodetect **CUDA → MPS → CPU** (hard rule). CLIP embeddings run on torch (MPS ok);
  the AutoKeras/TF classifier runs on CPU on macOS (note: TF has weak MPS — classifier stays CPU).
- **Model fetcher** `services/api/app/moderation/download_model.py` — downloads LAION's
  `clip_autokeras_binary_nsfw` SavedModel on first run into `NSFW_MODEL_DIR` (cached; idempotent).
- **Pipeline service** `services/api/app/service/moderation.py` — orchestrates a batch run:
  read incoming images from B2 → score → write `results.jsonl` → route (copy to approved/quarantine,
  delete incoming) → write `summary.csv`.
- **Routes** `services/api/app/runtime/batches.py` — full Batch CRUD+run (see §4 primary entity).
- **Copy/move + scoped-delete helpers** in `b2_client.py` — `copy_object`, `delete_prefix(prefix)`
  (routing = S3 copy-then-delete; there is no server-side move).
- **Frontend** — `app/batches/page.tsx` (scoped explorer / list), `app/batches/[id]/page.tsx`
  (detail: per-image score + route badge, summary, run/edit/delete), `app/batches/new/page.tsx`
  (create form). Components under `components/batches/*` (batch-table, batch-detail, score-badge,
  batch-form, run-panel). Dashboard cards rewritten to moderation stats.

**Bucket-explorer tension note:** the app's day-to-day view is the *scoped* Batches explorer
(`/batches`, restricted to `images/**` + `moderation/**` prefixes it owns). The starter's
full-bucket `/files` explorer is kept anyway (never removable) as a raw "Bucket" inspector —
useful for verifying the actual object layout the pipeline produces. Both ship.

## 3. B2 surface (S3-compatible only — no b2-native)

All access is the boto3 S3 client with `user_agent_extra` (Standard #2) — no b2-native SDK.

| Operation | S3 call | Used by |
|---|---|---|
| Ingest images + manifest | `put_object` | create batch |
| Write results.jsonl / summary.csv | `put_object` | run (audit) |
| List batches / images / logs | `list_objects_v2` (paginated) | batches explorer, detail, dashboard |
| Load image bytes for scoring | `get_object` | run |
| Route (move) | `copy_object` + `delete_object` | run |
| Object metadata | `head_object` | detail |
| Image preview / download | `generate_presigned_url` | detail, bucket explorer |
| Scoped batch delete | `delete_object` over the batch's prefixes only | delete batch |

No b2-native operations. **Scoped-delete safety (CLAUDE.local.md):** deleting a batch removes
ONLY keys under `images/incoming/<id>/`, `images/approved/<id>/`, `images/quarantine/<id>/`,
`moderation/logs/<id>/`. Never a bucket-wide wildcard delete.

### B2 key layout
```
images/incoming/<batch-id>/<filename>        # ingested images
images/incoming/<batch-id>/manifest.json     # source, submitter, ingest ts per image
images/approved/<batch-id>/<filename>         # routed: score < threshold
images/quarantine/<batch-id>/<filename>       # routed: score >= threshold
moderation/logs/<batch-id>/results.jsonl      # per-image {key, score, verdict}
moderation/logs/<batch-id>/summary.csv        # batch totals + threshold + run ts
```

## 4. Key features

1. **On-device NSFW scoring (CLIP-based, LAION-AI)** — `deployment: local`. CLIP ViT-L/14
   embeddings (open_clip) → LAION AutoKeras binary-NSFW classifier → score 0–1 (1 = NSFW).
   **No external API provider, no second key** (B2 credentials only). CPU-default with
   CUDA→MPS→CPU autodetect; TF classifier pinned to CPU on macOS (weak TF-MPS support — noted).
   Est. cost per demo run: **$0** (fully local).
2. **Batch ingest to B2** — upload a set of images + a manifest JSON into `images/incoming/<id>/`.
3. **Automated routing / quarantine** — safe images copied to `approved/`, unsafe to
   `quarantine/`, incoming originals removed after routing.
4. **Audit logs** — per-image `results.jsonl` + batch `summary.csv` written under
   `moderation/logs/<id>/` for compliance review; quarantined images retained for human review.
5. **Full-bucket explorer (kept)** + **scoped Batches explorer (added)**.
6. **Configurable safety threshold** — Strict / Balanced / Lenient presets (finite set → selector).

**External API providers:** NONE. Every feature is `deployment: local`. Genblaze is NOT
referenced in the description's stack, so provider calls are not routed through Genblaze.

### Primary-entity lifecycle — entity = **Moderation Batch** (`batch`)
The UI exposes ALL lifecycle verbs; none omitted:
- **create** — `/batches/new`: name, threshold preset, image upload → writes `incoming/<id>/` + manifest.
- **read** — `/batches` (list) and `/batches/[id]` (detail: images, scores, route badges, summary).
- **edit** — `PATCH /batches/{id}`: change **name** and **threshold** before/after a run; editing the
  threshold on an already-run batch re-routes on the next run. User-meaningful (re-triage).
- **delete** — `DELETE /batches/{id}`: scoped removal of the batch's four prefixes (see §3 safety).
- **run** — `POST /batches/{id}/run`: score → route → audit. The marquee action.

`omitted_ui_verbs`: **none** — all five verbs are built.

### Form UX conventions
- **Threshold** (create + edit) — finite set → **RadioGroup / Select**, never free text.
  Presets: `Strict` (0.50), `Balanced` (0.70, default), `Lenient` (0.90). (Higher score = more NSFW;
  quarantine when `score >= threshold`, so a *lower* threshold quarantines more aggressively —
  surfaced in FormDescription so the mapping isn't confusing.)
- **Create-form defaults (guidance only, no autofill button):** name placeholder e.g.
  `"ugc-batch-2026-07-20"`; threshold defaults to `Balanced` with a FormDescription explaining the
  score→route rule and a safe default for a sound test run.
- **Edit form** opens pre-filled with the batch's real name + current threshold.
- Follow `components/settings/settings-form.tsx` (react-hook-form + zod + `Select`/`FormDescription`)
  as the in-repo exemplar.

## 5. Doc transforms
- **Rewrite:** `docs/features/dashboard.md` (→ moderation stats), `docs/features/file-browser.md`
  (→ bucket explorer + note the scoped Batches explorer), `README.md`, `ARCHITECTURE.md`,
  `PRODUCT.md`, `AGENTS.md`, `docs/app-workflows.md` (ingest→score→route→audit).
- **Delete:** `docs/features/file-upload.md`, `docs/features/metadata-extraction.md`.
- **New stubs (from `docs/features/_template.md`):** `moderation-batches.md`, `nsfw-scoring.md`,
  `routing-quarantine.md`, `audit-logs.md`.
- `docs/exec-plans/completed/` on PASS receives this plan as `initial-scaffold.md`.

## 6. Rename table
| From (vibe-coding-starter-kit) | To (clip-nsfw-image-moderation) |
|---|---|
| repo/dir `vibe-coding-starter-kit` | `clip-nsfw-image-moderation` |
| kebab id `oss-starter-kit` / `b2ai-oss-start` slug | `clip-nsfw-image-moderation` |
| `APP_NAME = "OSS Starter Kit"` | `"CLIP NSFW Image Moderation"` |
| `APP_DESCRIPTION` | `"Local CLIP-based NSFW moderation pipeline backed by Backblaze B2"` |
| FastAPI `title="OSS Starter Kit API"` | `"CLIP NSFW Image Moderation API"` |
| package.json names, `pnpm-workspace` pkg names | `clip-nsfw-image-moderation` scope |
| UTM `utm_content=b2ai-oss-start` (sidebar footer) | `utm_content=b2ai-clip-nsfw-moderation` |
| `user_agent_extra="b2ai-oss-start"` | `user_agent_extra="b2ai-clip-nsfw-moderation"` |
| image tags / workflow slugs (`.github/workflows`, `infra/railway`) | `clip-nsfw-image-moderation` |

### 6a. B2 env-var standardization (CLAUDE.md Standard #3 — MANDATORY)
The starter deviates; the built sample MUST use the standard names. Update `config/settings.py`,
`main.py` (`REQUIRED_B2_SETTINGS` + `PLACEHOLDER_VALUES`), `b2_client.py`, `.env.example`:
| Starter | Standard #3 |
|---|---|
| `B2_KEY_ID` | `B2_APPLICATION_KEY_ID` |
| `B2_ENDPOINT` (literal URL) | `B2_REGION` → derive `https://s3.{B2_REGION}.backblazeb2.com` |
| `B2_APPLICATION_KEY` | `B2_APPLICATION_KEY` (unchanged) |
| `B2_BUCKET_NAME` | `B2_BUCKET_NAME` (unchanged) |
| `B2_PUBLIC_URL` | `B2_PUBLIC_URL_BASE` |

App-specific env (documented in `.env.example`, non-secret defaults):
`MODERATION_DEFAULT_THRESHOLD=0.70`, `CLIP_MODEL_NAME=ViT-L-14`, `CLIP_PRETRAINED=openai`,
`NSFW_MODEL_DIR=services/api/models`, `MODERATION_DEVICE=auto`, plus `NEXT_PUBLIC_API_URL`.

## 7. Dependencies (PINNED — unpinned ML deps are a false green)
Add to `services/api/requirements.txt` (keep existing fastapi/uvicorn/boto3/Pillow; **drop PyPDF2**):
```
open_clip_torch>=2.24.0,<3.0.0
torch>=2.2.0,<3.0.0
torchvision>=0.17.0,<1.0.0
tensorflow==2.15.1        # Keras-2 line — required for AutoKeras SavedModel load (TF 2.16+ = Keras 3 breaks autokeras)
autokeras==1.1.0
numpy<2                   # TF 2.15 + autokeras require numpy<2
huggingface_hub>=0.23.0,<1.0.0
ftfy>=6.1.0
regex>=2023.0.0
tqdm>=4.66.0
```
**Known native-runtime risk (flag for the verify step, not a build blocker):** TensorFlow 2.15 +
AutoKeras on macOS arm64 is fragile (wheel availability may require `tensorflow-macos`; keras-2 vs
keras-3 load path). This mirrors prior samples (paddleocr/deoldify) where the fallback is a native
`linux/arm64` container. Build pins the standard path; verify hardens it (container fallback if the
in-process TF load hangs/fails). Score model output: 0–1, 1 = NSFW.

## 8. Standards checklist (parent CLAUDE.md — reviewer gates on these)
1. S3-compatible API is the default (no b2-native). ✅
2. Custom `user_agent_extra` on every S3 client = `b2ai-clip-nsfw-moderation`. ✅
3. Standardized `B2_*` env names (§6a). ✅
