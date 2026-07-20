from datetime import datetime

from pydantic import BaseModel, Field

# Score >= threshold => quarantine. Higher score = more likely NSFW, so a LOWER
# threshold quarantines more aggressively. The UI offers these three presets.
THRESHOLD_PRESETS = {"strict": 0.50, "balanced": 0.70, "lenient": 0.90}

# Verdicts / statuses as plain strings (kept simple for JSON round-trips).
VERDICT_APPROVED = "approved"
VERDICT_QUARANTINE = "quarantine"
STATUS_PENDING = "pending"
STATUS_COMPLETED = "completed"


class BatchImage(BaseModel):
    filename: str
    key: str
    source: str | None = None
    ingested_at: datetime | None = None
    score: float | None = None
    verdict: str | None = None


class BatchSummary(BaseModel):
    id: str
    name: str
    threshold: float
    status: str
    created_at: datetime
    updated_at: datetime
    last_run_at: datetime | None = None
    image_count: int
    approved_count: int = 0
    quarantined_count: int = 0


class BatchDetail(BatchSummary):
    images: list[BatchImage] = []


class BatchCreateResult(BaseModel):
    id: str
    name: str
    threshold: float
    image_count: int


class BatchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    threshold: float | None = Field(default=None, gt=0.0, le=1.0)


class BatchRunResult(BaseModel):
    id: str
    scored: int
    approved: int
    quarantined: int
    threshold: float
    results_key: str
    summary_key: str
