from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    task_type: str = "sentiment"
    labels: list[str] = Field(default_factory=lambda: ["positive", "negative", "neutral"])


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    task_type: str
    labels: list[str]
    created_at: datetime


class DatasetCreate(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    description: str
    record_count: int
    created_at: datetime


class ImportResult(BaseModel):
    dataset_id: int
    imported: int
    skipped: int
    cleaned: int
    issues: int


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    text: str
    row_index: int
    ai_label: str | None = None
    ai_confidence: float | None = None
    ai_reason: str | None = None
    human_label: str | None = None
    review_status: str = "pending"
    is_flagged: bool = False


class AnnotateRequest(BaseModel):
    dataset_id: int
    limit: int = 50
    only_pending: bool = True
    prompt: str | None = None


class AnnotateResult(BaseModel):
    annotated: int
    failed: int
    mode: str


class ReviewRequest(BaseModel):
    record_id: int
    human_label: str | None = None
    action: str = "approve"
    note: str = ""
    reviewer: str = "reviewer"


class ReviewLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    annotation_id: int
    action: str
    old_label: str | None
    new_label: str | None
    reviewer: str
    note: str
    created_at: datetime


class QualityIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    record_id: int | None
    issue_type: str
    severity: str
    detail: str
    resolved: bool
    created_at: datetime


class LabelStat(BaseModel):
    label: str
    count: int


class AnalyticsOut(BaseModel):
    dataset_id: int
    total: int
    annotated: int
    reviewed: int
    pending_review: int
    ai_distribution: list[LabelStat]
    human_distribution: list[LabelStat]
    ai_human_agreement: float | None
    low_confidence: int
    flagged: int
    reviewer_stats: list[dict[str, Any]]


class DashboardOut(BaseModel):
    projects: int
    datasets: int
    records: int
    annotated: int
    reviewed: int
    pending_review: int
    open_issues: int
