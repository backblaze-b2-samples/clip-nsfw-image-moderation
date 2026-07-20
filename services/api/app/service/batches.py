"""Moderation-batch CRUD + shared manifest helpers.

The batch record lives durably at `moderation/logs/<id>/manifest.json` (the
audit prefix survives routing, which empties `images/incoming/<id>/`). The run
pipeline (score -> route -> audit) lives in `service.moderation`.
"""

import json
import logging
import re
import uuid
from datetime import UTC, datetime

from app.repo import (
    delete_prefix,
    get_object_bytes,
    list_objects,
    put_bytes,
)
from app.service.upload import sanitize_filename
from app.types import BatchCreateResult, BatchDetail, BatchSummary, BatchUpdate
from app.types.batches import STATUS_PENDING

logger = logging.getLogger(__name__)

INCOMING = "images/incoming/"
APPROVED = "images/approved/"
QUARANTINE = "images/quarantine/"
LOGS = "moderation/logs/"

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


class BatchNotFoundError(Exception):
    def __init__(self, batch_id: str):
        self.detail = f"Batch '{batch_id}' not found"
        super().__init__(self.detail)


class BatchValidationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def validate_id(batch_id: str) -> None:
    if not _ID_RE.match(batch_id):
        raise BatchValidationError("Invalid batch id")


def manifest_key(batch_id: str) -> str:
    return f"{LOGS}{batch_id}/manifest.json"


def batch_prefixes(batch_id: str) -> list[str]:
    """The four prefixes a batch owns — the ONLY keys a scoped delete touches."""
    return [
        f"{INCOMING}{batch_id}/",
        f"{APPROVED}{batch_id}/",
        f"{QUARANTINE}{batch_id}/",
        f"{LOGS}{batch_id}/",
    ]


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return s or "batch"


def read_manifest(batch_id: str) -> dict:
    try:
        raw = get_object_bytes(manifest_key(batch_id))
    except RuntimeError as e:
        raise BatchNotFoundError(batch_id) from e
    return json.loads(raw)


def write_manifest(manifest: dict) -> None:
    put_bytes(
        manifest_key(manifest["id"]),
        json.dumps(manifest, indent=2).encode("utf-8"),
        "application/json",
    )


def summary_from_manifest(m: dict) -> BatchSummary:
    return BatchSummary(
        id=m["id"],
        name=m["name"],
        threshold=m["threshold"],
        status=m["status"],
        created_at=m["created_at"],
        updated_at=m["updated_at"],
        last_run_at=m.get("last_run_at"),
        image_count=len(m.get("images", [])),
        approved_count=m.get("approved_count", 0),
        quarantined_count=m.get("quarantined_count", 0),
    )


def create_batch(
    name: str, threshold: float, images: list[tuple[str, bytes, str]]
) -> BatchCreateResult:
    """Ingest images to incoming/<id>/ and write the batch manifest."""
    name = (name or "").strip()
    if len(name) < 2:
        raise BatchValidationError("Batch name must be at least 2 characters")
    if not 0.0 < threshold <= 1.0:
        raise BatchValidationError("Threshold must be between 0 and 1")
    if not images:
        raise BatchValidationError("At least one image is required")

    batch_id = f"{_slug(name)[:40]}-{uuid.uuid4().hex[:8]}"
    ts = now_iso()
    entries: list[dict] = []
    seen: set[str] = set()
    for filename, data, content_type in images:
        safe = sanitize_filename(filename) or "image"
        candidate, i = safe, 1
        while candidate in seen:  # guarantee unique keys within the batch prefix
            candidate = f"{i}-{safe}"
            i += 1
        seen.add(candidate)
        key = f"{INCOMING}{batch_id}/{candidate}"
        put_bytes(key, data, content_type or "application/octet-stream")
        entries.append(
            {
                "filename": candidate,
                "key": key,
                "source": "upload",
                "ingested_at": ts,
                "score": None,
                "verdict": None,
            }
        )

    manifest = {
        "id": batch_id,
        "name": name,
        "threshold": threshold,
        "status": STATUS_PENDING,
        "created_at": ts,
        "updated_at": ts,
        "last_run_at": None,
        "approved_count": 0,
        "quarantined_count": 0,
        "images": entries,
    }
    write_manifest(manifest)
    logger.info("Batch created: id=%s images=%d", batch_id, len(entries))
    return BatchCreateResult(
        id=batch_id, name=name, threshold=threshold, image_count=len(entries)
    )


def list_batches() -> list[BatchSummary]:
    """List every batch by scanning the audit prefix for manifests."""
    summaries: list[BatchSummary] = []
    for obj in list_objects(LOGS):
        if not obj["Key"].endswith("/manifest.json"):
            continue
        try:
            m = json.loads(get_object_bytes(obj["Key"]))
            summaries.append(summary_from_manifest(m))
        except (RuntimeError, json.JSONDecodeError, KeyError):
            logger.warning("Skipping unreadable manifest: %s", obj["Key"])
    summaries.sort(key=lambda s: s.created_at, reverse=True)
    return summaries


def get_batch(batch_id: str) -> BatchDetail:
    validate_id(batch_id)
    m = read_manifest(batch_id)
    return BatchDetail(
        **summary_from_manifest(m).model_dump(), images=m.get("images", [])
    )


def update_batch(batch_id: str, update: BatchUpdate) -> BatchSummary:
    """Rename or re-threshold a batch. Re-thresholding re-routes on the next run."""
    validate_id(batch_id)
    m = read_manifest(batch_id)
    if update.name is not None:
        m["name"] = update.name.strip()
    if update.threshold is not None:
        m["threshold"] = update.threshold
    m["updated_at"] = now_iso()
    write_manifest(m)
    return summary_from_manifest(m)


def delete_batch(batch_id: str) -> int:
    """Scoped delete: remove ONLY this batch's four prefixes. Never bucket-wide."""
    validate_id(batch_id)
    read_manifest(batch_id)  # 404 if the batch does not exist
    deleted = 0
    for prefix in batch_prefixes(batch_id):
        deleted += delete_prefix(prefix)
    logger.info("Batch deleted: id=%s objects=%d", batch_id, deleted)
    return deleted


def get_moderation_stats() -> dict:
    """Dashboard aggregates across every batch (read from manifests)."""
    batches = list_batches()
    return {
        "total_batches": len(batches),
        "pending_batches": sum(1 for b in batches if b.status == STATUS_PENDING),
        "images_scored": sum(b.approved_count + b.quarantined_count for b in batches),
        "approved": sum(b.approved_count for b in batches),
        "quarantined": sum(b.quarantined_count for b in batches),
    }
