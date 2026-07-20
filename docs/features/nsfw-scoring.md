<!-- last_verified: 2026-07-20 -->
# Feature: NSFW Scoring (on-device)

## Purpose
Score every image 0–1 (1 = NSFW) entirely on the operator's hardware — no
third-party moderation API and no second API key.

## Used By
- API: invoked inside `POST /batches/{id}/run`
- Job: `services/api/app/service/moderation.py::run_batch`

## Core Functions
- `services/api/app/moderation/scorer.py` — `score_images(list[bytes]) -> list[float]`, lazy-singleton model load, device resolution
- `services/api/app/moderation/download_model.py` — one-time fetch/cache of LAION's SavedModel

## Canonical Files
- Scoring engine: `services/api/app/moderation/scorer.py`

## Inputs
- images: `list[bytes]` (raw image bytes loaded from B2)
- Config: `CLIP_MODEL_NAME` (default `ViT-L-14`), `CLIP_PRETRAINED` (default `openai`),
  `NSFW_MODEL_DIR` (default `models`), `MODERATION_DEVICE` (default `auto`)

## Outputs
- `list[float]` — one 0..1 score per image (clamped)
- Side effect: first call downloads CLIP weights + the LAION AutoKeras SavedModel into `NSFW_MODEL_DIR` (cached, idempotent)

## Flow
- Resolve device: CLIP stage picks CUDA → Apple MPS → CPU (defaults to CPU; never requires a GPU)
- Load CLIP (open_clip) + preprocess; load LAION AutoKeras classifier on CPU
- Preprocess each image → CLIP `encode_image` → L2-normalize embeddings
- Feed normalized embeddings to the classifier → per-image sigmoid score

## Edge Cases
- Empty input → returns `[]` without importing torch/TensorFlow
- On macOS arm64 the TF 2.15 + AutoKeras load path is fragile; the pinned versions
  in `requirements.txt` are the known-good line. If the in-process TF load hangs or
  fails, the fallback is a native `linux/arm64` container (see tech-debt tracker)
- Heavy ML imports are deferred to call time so the app and tests import without the ML stack

## UX States
- The run action shows "Scoring on-device…" while `run_batch` executes

## Verification
- Test files: `services/api/tests/test_batches.py` (`test_run_routes_by_threshold` monkeypatches the scorer; `test_score_images_empty_is_noop` guards the ML-free path)
- Required cases: empty input no-op, verdict thresholding
- Quick verify command: `pnpm test:api`
- Full verify command: create a small batch, `POST /batches/{id}/run`, confirm scores 0..1 and routed objects on B2
- Pass criteria: real scores returned (no mocks/synthetic outputs), images routed on B2

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Routing & Quarantine](routing-quarantine.md)
- LAION-AI CLIP-based NSFW Detector: https://github.com/LAION-AI/CLIP-based-NSFW-Detector
