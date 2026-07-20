"""CLIP + LAION AutoKeras NSFW scorer.

`score_images(list[bytes]) -> list[float]` returns a 0..1 safety score per image
(1 = NSFW). The model is a lazy singleton loaded on first use and reused after.

Device policy (hard rule): the CLIP stage runs on the first available of
CUDA -> Apple MPS -> CPU and defaults to CPU; a GPU is never required. The
TensorFlow/AutoKeras classifier always runs on CPU (weak TF-MPS support on
macOS). All heavy imports are deferred to call time.
"""

import io
import logging
from threading import Lock

from app.config import settings
from app.moderation.download_model import ensure_model

logger = logging.getLogger(__name__)

_lock = Lock()
# Populated once by _load(): clip model, image preprocess, nsfw classifier, device.
_state: dict = {"clip": None, "preprocess": None, "nsfw": None, "device": None}


def _mps_available() -> bool:
    try:
        import torch

        backend = getattr(torch.backends, "mps", None)
        return backend is not None and backend.is_available()
    except Exception:
        return False


def resolve_device() -> str:
    """Pick the torch device for the CLIP stage. Auto = CUDA -> MPS -> CPU."""
    import torch

    configured = (settings.moderation_device or "auto").strip().lower()
    if configured == "cpu":
        return "cpu"
    if configured == "cuda":
        return "cuda" if torch.cuda.is_available() else "cpu"
    if configured == "mps":
        return "mps" if _mps_available() else "cpu"
    # auto
    if torch.cuda.is_available():
        return "cuda"
    if _mps_available():
        return "mps"
    return "cpu"


def _load():
    """Lazy-load the CLIP model, preprocess and LAION classifier (once)."""
    if _state["nsfw"] is not None:
        return _state["clip"], _state["preprocess"], _state["nsfw"], _state["device"]
    with _lock:
        if _state["nsfw"] is not None:
            return (
                _state["clip"],
                _state["preprocess"],
                _state["nsfw"],
                _state["device"],
            )
        import autokeras as ak
        import open_clip
        from tensorflow.keras.models import load_model

        device = resolve_device()
        logger.info(
            "Loading CLIP %s/%s on %s + LAION AutoKeras classifier (CPU)",
            settings.clip_model_name,
            settings.clip_pretrained,
            device,
        )
        clip_model, _, preprocess = open_clip.create_model_and_transforms(
            settings.clip_model_name, pretrained=settings.clip_pretrained
        )
        clip_model = clip_model.to(device).eval()

        model_dir = ensure_model()
        nsfw = load_model(str(model_dir), custom_objects=ak.CUSTOM_OBJECTS, compile=False)

        _state.update(
            clip=clip_model, preprocess=preprocess, nsfw=nsfw, device=device
        )
    return _state["clip"], _state["preprocess"], _state["nsfw"], _state["device"]


def score_images(images: list[bytes]) -> list[float]:
    """Score a list of raw image bytes. Returns one 0..1 float per image."""
    if not images:
        return []

    import numpy as np
    import torch
    from PIL import Image

    clip_model, preprocess, nsfw, device = _load()

    tensors = []
    for data in images:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        tensors.append(preprocess(img))
    batch = torch.stack(tensors).to(device)

    with torch.no_grad():
        feats = clip_model.encode_image(batch)
        # LAION's classifier expects L2-normalized CLIP embeddings.
        feats = feats / feats.norm(dim=-1, keepdim=True)
    emb = feats.detach().cpu().numpy().astype("float32")

    preds = np.asarray(nsfw.predict(emb, verbose=0)).reshape(-1)
    return [float(min(max(p, 0.0), 1.0)) for p in preds]
