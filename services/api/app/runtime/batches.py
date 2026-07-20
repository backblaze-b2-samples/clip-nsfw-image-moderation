import logging

# Sync `def` handlers on purpose: the call chain is blocking (boto3 + torch/TF).
# Starlette runs sync handlers in its threadpool, so a long scoring run doesn't
# stall the event loop / other requests.
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.service.batches import (
    BatchNotFoundError,
    BatchValidationError,
    create_batch,
    delete_batch,
    get_batch,
    get_moderation_stats,
    list_batches,
    update_batch,
)
from app.service.moderation import run_batch
from app.types import (
    BatchCreateResult,
    BatchDetail,
    BatchRunResult,
    BatchSummary,
    BatchUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Only image types are accepted into a moderation batch.
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_BYTES = 25 * 1024 * 1024  # 25MB per image


@router.get("/batches", response_model=list[BatchSummary])
def list_batches_endpoint():
    return list_batches()


@router.get("/batches/stats")
def batch_stats_endpoint():
    return get_moderation_stats()


@router.get("/batches/{batch_id}", response_model=BatchDetail)
def get_batch_endpoint(batch_id: str):
    try:
        return get_batch(batch_id)
    except BatchValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except BatchNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.post("/batches", response_model=BatchCreateResult, status_code=201)
def create_batch_endpoint(
    name: str = Form(...),
    threshold: float = Form(...),
    files: list[UploadFile] = File(...),
):
    images: list[tuple[str, bytes, str]] = []
    for f in files:
        content_type = f.content_type or "application/octet-stream"
        if content_type not in _ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported image type '{content_type}' for '{f.filename}'",
            )
        data = f.file.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        if len(data) > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail=f"Image too large: {f.filename}")
        images.append((f.filename or "image", data, content_type))

    try:
        return create_batch(name=name, threshold=threshold, images=images)
    except BatchValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None


@router.patch("/batches/{batch_id}", response_model=BatchSummary)
def update_batch_endpoint(batch_id: str, update: BatchUpdate):
    try:
        return update_batch(batch_id, update)
    except BatchValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except BatchNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.delete("/batches/{batch_id}")
def delete_batch_endpoint(batch_id: str):
    try:
        deleted = delete_batch(batch_id)
    except BatchValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except BatchNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    return {"deleted": True, "id": batch_id, "objects_removed": deleted}


@router.post("/batches/{batch_id}/run", response_model=BatchRunResult)
def run_batch_endpoint(batch_id: str):
    try:
        return run_batch(batch_id)
    except BatchValidationError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except BatchNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError as e:
        logger.error("Batch run failed: id=%s err=%s", batch_id, e)
        raise HTTPException(status_code=500, detail="Batch run failed") from None
