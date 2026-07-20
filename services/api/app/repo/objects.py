"""Raw object operations used by the moderation pipeline.

Lives in the repo layer alongside `b2_client` (AGENTS.md §3: boto3 only in
repo/). It reuses `b2_client`'s cached S3 client, pagination and cache
invalidation so there is a single S3 client with the custom user agent.

Routing = copy-then-delete (B2/S3 has no server-side move). Scoped deletes are
enforced here: `delete_prefix` refuses the empty prefix so a batch delete can
never turn into a full-bucket wipe.
"""

import io

from botocore.exceptions import ClientError

from app.config import settings
from app.repo.b2_client import (
    _fetch_all_objects,
    _invalidate_list_cache,
    get_s3_client,
)


def get_object_bytes(key: str) -> bytes:
    """Download an object's full body into memory. Raises RuntimeError on failure."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
        return response["Body"].read()
    except ClientError as e:
        raise RuntimeError(f"B2 get_object failed for '{key}': {e}") from e


def put_bytes(key: str, data: bytes, content_type: str) -> None:
    """Write raw bytes to a key. Raises RuntimeError on failure."""
    client = get_s3_client()
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name,
            Key=key,
            Body=io.BytesIO(data),
            ContentType=content_type,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 put_object failed for '{key}': {e}") from e
    _invalidate_list_cache()


def copy_object(src_key: str, dest_key: str) -> None:
    """Server-side copy within the bucket (B2 has no native move).

    Routing copies to the destination prefix, then deletes the source. Raises
    RuntimeError on failure.
    """
    client = get_s3_client()
    try:
        client.copy_object(
            Bucket=settings.b2_bucket_name,
            CopySource={"Bucket": settings.b2_bucket_name, "Key": src_key},
            Key=dest_key,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 copy failed '{src_key}' -> '{dest_key}': {e}") from e
    _invalidate_list_cache()


def list_objects(prefix: str) -> list[dict]:
    """Return raw B2 objects (Key/Size/LastModified) under a NON-EMPTY prefix.

    Guards against the empty prefix so callers can never accidentally scan the
    whole bucket through this helper. Raises RuntimeError on S3 failure.
    """
    if not prefix:
        raise ValueError("list_objects requires a non-empty prefix")
    return _fetch_all_objects(prefix)


def delete_prefix(prefix: str) -> int:
    """Delete every object under `prefix`, batched. Returns the count deleted.

    SAFETY: the empty prefix is rejected outright so this can never wipe the
    whole bucket. A batch delete routes one scoped prefix at a time through
    here — never a bucket-wide wildcard. Raises RuntimeError on S3 failure.
    """
    if not prefix:
        raise ValueError(
            "delete_prefix requires a non-empty prefix (refusing full-bucket delete)"
        )
    client = get_s3_client()
    objects = _fetch_all_objects(prefix)
    deleted = 0
    try:
        for start in range(0, len(objects), 1000):  # S3 delete_objects caps at 1000
            chunk = objects[start : start + 1000]
            client.delete_objects(
                Bucket=settings.b2_bucket_name,
                Delete={"Objects": [{"Key": o["Key"]} for o in chunk]},
            )
            deleted += len(chunk)
    except ClientError as e:
        raise RuntimeError(f"B2 delete_prefix failed for '{prefix}': {e}") from e
    if deleted:
        _invalidate_list_cache()
    return deleted
