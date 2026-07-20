"""The run pipeline: score -> route -> audit.

Routing is copy-then-delete (B2 has no server-side move). Scoring goes through
the on-device CLIP + LAION engine in `app.moderation`. Batch CRUD and the shared
manifest helpers live in `app.service.batches`.
"""

import csv
import io
import json
import logging

from app.moderation.scorer import score_images
from app.repo import copy_object, delete_file, get_object_bytes, put_bytes
from app.service.batches import (
    APPROVED,
    LOGS,
    QUARANTINE,
    now_iso,
    read_manifest,
    validate_id,
    write_manifest,
)
from app.types import BatchRunResult
from app.types.batches import STATUS_COMPLETED, VERDICT_APPROVED, VERDICT_QUARANTINE

logger = logging.getLogger(__name__)


def _target_key(batch_id: str, filename: str, verdict: str) -> str:
    prefix = QUARANTINE if verdict == VERDICT_QUARANTINE else APPROVED
    return f"{prefix}{batch_id}/{filename}"


def run_batch(batch_id: str) -> BatchRunResult:
    """Score every image, route to approved/quarantine, write audit artifacts."""
    validate_id(batch_id)
    m = read_manifest(batch_id)
    threshold = float(m["threshold"])

    loaded: list[dict] = []
    payloads: list[bytes] = []
    for entry in m.get("images", []):
        try:
            payloads.append(get_object_bytes(entry["key"]))
            loaded.append(entry)
        except RuntimeError:
            logger.warning("Skipping missing image during run: %s", entry["key"])

    scores = score_images(payloads)  # real on-device CLIP + LAION scoring

    approved = quarantined = 0
    for entry, score in zip(loaded, scores, strict=True):
        verdict = VERDICT_QUARANTINE if score >= threshold else VERDICT_APPROVED
        dest = _target_key(batch_id, entry["filename"], verdict)
        if entry["key"] != dest:
            copy_object(entry["key"], dest)  # copy-then-delete = route/move
            delete_file(entry["key"])
            entry["key"] = dest
        entry["score"] = score
        entry["verdict"] = verdict
        if verdict == VERDICT_QUARANTINE:
            quarantined += 1
        else:
            approved += 1

    run_at = now_iso()
    results_key, summary_key = _write_audit(m, threshold, run_at, approved, quarantined)

    m["status"] = STATUS_COMPLETED
    m["last_run_at"] = run_at
    m["updated_at"] = run_at
    m["approved_count"] = approved
    m["quarantined_count"] = quarantined
    write_manifest(m)

    logger.info(
        "Batch run: id=%s scored=%d approved=%d quarantined=%d threshold=%.2f",
        batch_id, len(scores), approved, quarantined, threshold,
    )
    return BatchRunResult(
        id=batch_id,
        scored=len(scores),
        approved=approved,
        quarantined=quarantined,
        threshold=threshold,
        results_key=results_key,
        summary_key=summary_key,
    )


def _write_audit(
    m: dict, threshold: float, run_at: str, approved: int, quarantined: int
) -> tuple[str, str]:
    """Write per-image results.jsonl + batch summary.csv under the logs prefix."""
    batch_id = m["id"]
    results_key = f"{LOGS}{batch_id}/results.jsonl"
    summary_key = f"{LOGS}{batch_id}/summary.csv"

    lines = [
        json.dumps(
            {
                "key": e["key"],
                "filename": e["filename"],
                "score": e["score"],
                "verdict": e["verdict"],
            }
        )
        for e in m.get("images", [])
        if e.get("verdict") is not None
    ]
    put_bytes(results_key, ("\n".join(lines) + "\n").encode("utf-8"), "application/x-ndjson")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["batch_id", "name", "threshold", "run_at", "total", "approved", "quarantined"]
    )
    writer.writerow(
        [batch_id, m["name"], f"{threshold:.2f}", run_at,
         approved + quarantined, approved, quarantined]
    )
    put_bytes(summary_key, buf.getvalue().encode("utf-8"), "text/csv")
    return results_key, summary_key
