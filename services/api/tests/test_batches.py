"""Tests for moderation-batch CRUD + the score/route pipeline.

The on-device scorer is monkeypatched so these run without torch/TensorFlow;
`test_score_images_empty_is_noop` guards the ML-free early-return path.
"""

import pytest

from app.service import batches as bsvc
from app.service import moderation as msvc
from app.types.batches import BatchUpdate


def _manifest(images):
    return {
        "id": "b-1",
        "name": "demo",
        "threshold": 0.7,
        "status": "pending",
        "created_at": "2026-07-20T00:00:00+00:00",
        "updated_at": "2026-07-20T00:00:00+00:00",
        "last_run_at": None,
        "approved_count": 0,
        "quarantined_count": 0,
        "images": images,
    }


def test_batch_prefixes_are_scoped():
    prefixes = bsvc.batch_prefixes("abc-123")
    assert prefixes == [
        "images/incoming/abc-123/",
        "images/approved/abc-123/",
        "images/quarantine/abc-123/",
        "moderation/logs/abc-123/",
    ]
    # Every prefix is non-empty and batch-scoped — never a bucket-wide wildcard.
    assert all(p and "abc-123/" in p for p in prefixes)


def test_validate_id_rejects_traversal():
    with pytest.raises(bsvc.BatchValidationError):
        bsvc.validate_id("../etc")
    with pytest.raises(bsvc.BatchValidationError):
        bsvc.validate_id("has/slash")


def test_create_batch_ingests_and_writes_manifest(monkeypatch):
    puts: list[str] = []
    monkeypatch.setattr(bsvc, "put_bytes", lambda key, data, ct: puts.append(key))

    result = bsvc.create_batch("UGC Batch", 0.7, [("a.png", b"bytes", "image/png")])

    assert result.image_count == 1
    assert result.threshold == 0.7
    assert any(k.startswith("images/incoming/") and k.endswith("a.png") for k in puts)
    assert any(k.startswith("moderation/logs/") and k.endswith("/manifest.json") for k in puts)


def test_create_batch_rejects_empty_images():
    with pytest.raises(bsvc.BatchValidationError):
        bsvc.create_batch("x-batch", 0.7, [])


def test_delete_batch_only_touches_its_prefixes(monkeypatch):
    monkeypatch.setattr(bsvc, "read_manifest", lambda bid: {"id": bid})
    deleted: list[str] = []
    monkeypatch.setattr(bsvc, "delete_prefix", lambda p: (deleted.append(p), 1)[1])

    n = bsvc.delete_batch("abc-123")

    assert n == 4
    assert deleted == bsvc.batch_prefixes("abc-123")


def test_update_batch_changes_name_and_threshold(monkeypatch):
    manifest = _manifest([])
    monkeypatch.setattr(bsvc, "read_manifest", lambda bid: manifest)
    monkeypatch.setattr(bsvc, "write_manifest", lambda m: None)

    summary = bsvc.update_batch("b-1", BatchUpdate(name="renamed", threshold=0.9))

    assert summary.name == "renamed"
    assert summary.threshold == 0.9


def test_run_routes_by_threshold(monkeypatch):
    manifest = _manifest(
        [
            {"filename": "safe.png", "key": "images/incoming/b-1/safe.png",
             "source": "upload", "ingested_at": None, "score": None, "verdict": None},
            {"filename": "bad.png", "key": "images/incoming/b-1/bad.png",
             "source": "upload", "ingested_at": None, "score": None, "verdict": None},
        ]
    )
    saved: dict = {}
    copies: list[tuple[str, str]] = []
    monkeypatch.setattr(msvc, "read_manifest", lambda bid: manifest)
    monkeypatch.setattr(msvc, "write_manifest", lambda m: saved.update(m))
    monkeypatch.setattr(msvc, "get_object_bytes", lambda key: b"img")
    monkeypatch.setattr(msvc, "copy_object", lambda s, d: copies.append((s, d)))
    monkeypatch.setattr(msvc, "delete_file", lambda k: None)
    monkeypatch.setattr(msvc, "put_bytes", lambda *a, **k: None)
    # 0.2 < 0.7 -> approved ; 0.95 >= 0.7 -> quarantine
    monkeypatch.setattr(msvc, "score_images", lambda imgs: [0.2, 0.95])

    result = msvc.run_batch("b-1")

    assert result.approved == 1
    assert result.quarantined == 1
    assert saved["status"] == "completed"
    assert manifest["images"][0]["verdict"] == "approved"
    assert manifest["images"][1]["verdict"] == "quarantine"
    dests = [d for _, d in copies]
    assert "images/approved/b-1/safe.png" in dests
    assert "images/quarantine/b-1/bad.png" in dests


def test_score_images_empty_is_noop():
    # Early return means no torch/TensorFlow import is triggered.
    from app.moderation.scorer import score_images

    assert score_images([]) == []
