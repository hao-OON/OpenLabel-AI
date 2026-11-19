from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Annotation, DataRecord, Dataset, Project, QualityIssue, ReviewLog
from ..schemas import AnalyticsOut, DashboardOut, LabelStat

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    projects = db.scalar(select(func.count(Project.id))) or 0
    datasets = db.scalar(select(func.count(Dataset.id))) or 0
    records = db.scalar(select(func.count(DataRecord.id))) or 0
    annotated = db.scalar(
        select(func.count(Annotation.id)).where(Annotation.ai_label.is_not(None))
    ) or 0
    reviewed = db.scalar(
        select(func.count(Annotation.id)).where(
            Annotation.review_status.in_(["approved", "modified"])
        )
    ) or 0
    pending = db.scalar(
        select(func.count(Annotation.id)).where(Annotation.review_status == "pending")
    ) or 0
    open_issues = db.scalar(
        select(func.count(QualityIssue.id)).where(QualityIssue.resolved == 0)
    ) or 0
    return DashboardOut(
        projects=projects,
        datasets=datasets,
        records=records,
        annotated=annotated,
        reviewed=reviewed,
        pending_review=pending,
        open_issues=open_issues,
    )


@router.get("/datasets/{dataset_id}", response_model=AnalyticsOut)
def dataset_analytics(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    records = db.scalars(
        select(DataRecord)
        .options(joinedload(DataRecord.annotation))
        .where(DataRecord.dataset_id == dataset_id)
    ).all()
    annotations = [r.annotation for r in records if r.annotation]
    total = len(records)
    ai_labels = [a.ai_label for a in annotations if a.ai_label]
    human_labels = [a.human_label for a in annotations if a.human_label]
    reviewed = sum(1 for a in annotations if a.review_status in ("approved", "modified"))
    pending = sum(1 for a in annotations if a.review_status == "pending")

    pairs = [
        (a.ai_label, a.human_label)
        for a in annotations
        if a.ai_label and a.human_label
    ]
    agreement = (
        round(sum(1 for ai, h in pairs if ai == h) / len(pairs), 4) if pairs else None
    )

    # join 依赖模型外键关系自动推断：ReviewLog.annotation_id -> Annotation.id -> Annotation.record_id -> DataRecord.id
    logs = (
        db.query(ReviewLog.reviewer, func.count(ReviewLog.id))
        .join(Annotation)
        .join(DataRecord)
        .filter(DataRecord.dataset_id == dataset_id)
        .group_by(ReviewLog.reviewer)
        .all()
    )

    return AnalyticsOut(
        dataset_id=dataset_id,
        total=total,
        annotated=len(annotations),
        reviewed=reviewed,
        pending_review=pending,
        ai_distribution=[LabelStat(label=k, count=v) for k, v in Counter(ai_labels).most_common()],
        human_distribution=[
            LabelStat(label=k, count=v) for k, v in Counter(human_labels).most_common()
        ],
        ai_human_agreement=agreement,
        low_confidence=sum(
            1 for a in annotations if a.ai_confidence is not None and a.ai_confidence < 0.6
        ),
        flagged=sum(1 for a in annotations if a.is_flagged),
        reviewer_stats=[{"reviewer": r, "count": c} for r, c in logs],
    )
