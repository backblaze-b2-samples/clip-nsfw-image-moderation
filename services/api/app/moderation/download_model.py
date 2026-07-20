"""Fetch and cache LAION-AI's `clip_autokeras_binary_nsfw` SavedModel.

Idempotent: the model is downloaded once into `NSFW_MODEL_DIR` and reused on
every subsequent run. Pure stdlib (urllib + zipfile) so importing this module
is cheap and never pulls the ML stack.
"""

import logging
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# LAION-AI/CLIP-based-NSFW-Detector ships the AutoKeras SavedModel as a zip.
MODEL_URL = (
    "https://github.com/LAION-AI/CLIP-based-NSFW-Detector/"
    "raw/main/clip_autokeras_binary_nsfw.zip"
)
MODEL_DIRNAME = "clip_autokeras_binary_nsfw"


def model_base_dir() -> Path:
    """Resolve NSFW_MODEL_DIR, anchored at services/api/ when relative."""
    base = Path(settings.nsfw_model_dir)
    if not base.is_absolute():
        # moderation/ -> app/ -> services/api/
        base = Path(__file__).resolve().parents[2] / base
    return base


def model_path() -> Path:
    return model_base_dir() / MODEL_DIRNAME


def is_downloaded() -> bool:
    return (model_path() / "saved_model.pb").exists()


def ensure_model() -> Path:
    """Return the local SavedModel dir, downloading it on first use."""
    dest = model_path()
    if is_downloaded():
        return dest

    base = model_base_dir()
    base.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading LAION NSFW model from %s", MODEL_URL)

    with tempfile.TemporaryDirectory() as tmp:
        zip_path = Path(tmp) / "model.zip"
        with urllib.request.urlopen(MODEL_URL) as resp, open(zip_path, "wb") as fh:
            shutil.copyfileobj(resp, fh)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(tmp)

        # The archive extracts to a top-level `clip_autokeras_binary_nsfw/` dir.
        extracted = Path(tmp) / MODEL_DIRNAME
        if not (extracted / "saved_model.pb").exists():
            # Fallback: find the SavedModel dir wherever it landed.
            found = next(Path(tmp).rglob("saved_model.pb"), None)
            if found is None:
                raise RuntimeError("LAION NSFW model archive missing saved_model.pb")
            extracted = found.parent

        if dest.exists():
            shutil.rmtree(dest)
        shutil.move(str(extracted), str(dest))

    logger.info("LAION NSFW model ready at %s", dest)
    return dest
