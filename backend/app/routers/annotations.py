from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Annotation, DataRecord, Dataset, ReviewLog
from ..schemas import (
    AnnotateRequest,
    AnnotateResult,
    RecordOut,
    ReviewLogOut,
    ReviewRequest,
)
from ..services.llm import classify
from .projects import get_project_or_404

router = APIRouter(prefix="/api", tags=["annotation"])

LOW_CONFIDENCE = 0.6


def serialize_record(rec: DataRecord) -> RecordOut:
    ann = rec.annotation
    return RecordOut(
        id=rec.id,
        dataset_id=rec.dataset_id,
        text=rec.text,
        row_index=rec.row_index,
        ai_label=ann.ai_label if ann else None,
        ai_confidence=ann.ai_confidence if ann else None,
        ai_reason=ann.ai_reason if ann else None,
        human_label=ann.human_label if ann else None,
        review_status=ann.review_status if ann else "unannotated",
        is_flagged=bool(ann.is_flagged) if ann else False,
    )


@router.get("/datasets/{dataset_id}/records", response_model=list[RecordOut])
def list_records(
    dataset_id: int,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    if not db.get(Dataset, dataset_id):
        raise HTTPException(404, "Dataset not found")
    query = (
        select(DataRecord)
        .options(joinedload(DataRecord.annotation))
        .where(DataRecord.dataset_id == dataset_id)
        .order_by(DataRecord.row_index, DataRecord.id)
    )
    if status == "pending":
        query = query.outerjoin(Annotation).where(
            (Annotation.id.is_(None)) | (Annotation.review_status == "pending")
        )
    elif status == "low_confidence":
        # 低置信度队列：按置信度升序，确保最不确定的样本优先返回，避免被 limit 截断
        query = (
            query.join(Annotation)
            .where(Annotation.ai_confidence < LOW_CONFIDENCE, Annotation.review_status == "pending")
            .order_by(Annotation.ai_confidence.asc(), DataRecord.row_index, DataRecord.id)
        )
    elif status == "flagged":
        query = query.join(Annotation).where(Annotation.is_flagged == 1)
    elif status == "reviewed":
        query = query.join(Annotation).where(
            Annotation.review_status.in_(["approved", "modified"])
        )
    elif status:
        query = query.join(Annotation).where(Annotation.review_status == status)
    return [serialize_record(r) for r in db.scalars(query.limit(limit).offset(offset)).all()]


@router.post("/annotations/run", response_model=AnnotateResult)
def run_annotation(payload: AnnotateRequest, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, payload.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    project = get_project_or_404(db, dataset.project_id)
    labels = project.labels or ["positive", "negative", "neutral"]

    query = (
        select(DataRecord)
        .options(joinedload(DataRecord.annotation))
        .where(DataRecord.dataset_id == payload.dataset_id)
        .order_by(DataRecord.row_index, DataRecord.id)
    )
    records = db.scalars(query).unique().all()

    annotated = failed = 0
    mode = "heuristic"
    for rec in records:
        if payload.only_pending and rec.annotation and rec.annotation.ai_label:
            continue
        if annotated >= payload.limit:
            break
        try:
            result, used = classify(rec.text, labels, payload.prompt)
            mode = used
        except Exception:
            failed += 1
            continue
        ann = rec.annotation
        if not ann:
            ann = Annotation(record_id=rec.id)
            db.add(ann)
        ann.ai_label = result.label
        ann.ai_confidence = result.confidence
        ann.ai_reason = result.reason
        if ann.review_status in (None, "unannotated"):
            ann.review_status = "pending"
        annotated += 1

    db.commit()
    return AnnotateResult(annotated=annotated, failed=failed, mode=mode)


@router.post("/annotations/review", response_model=RecordOut)
def review_record(payload: ReviewRequest, db: Session = Depends(get_db)):
    rec = db.get(DataRecord, payload.record_id)
    if not rec:
        raise HTTPException(404, "Record not found")

    ann = rec.annotation
    if not ann:
        ann = Annotation(record_id=rec.id, review_status="pending")
        db.add(ann)
        db.flush()

    old_label = ann.human_label or ann.ai_label
    if payload.action == "approve":
        ann.human_label = payload.human_label or ann.human_label or ann.ai_label
        ann.review_status = "approved"
    elif payload.action == "modify":
        if not payload.human_label:
            raise HTTPException(400, "human_label is required for modify")
        ann.human_label = payload.human_label
        ann.review_status = "modified"
    elif payload.action == "flag":
        ann.is_flagged = 1
        ann.review_status = "flagged"
    else:
        raise HTTPException(400, "action must be approve, modify or flag")

    log = ReviewLog(
        annotation_id=ann.id,
        action=payload.action,
        old_label=old_label,
        new_label=ann.human_label,
        reviewer=payload.reviewer,
        note=payload.note,
    )
    db.add(log)
    db.commit()
    db.refresh(rec)
    return serialize_record(rec)


@router.get("/records/{record_id}/history", response_model=list[ReviewLogOut])
def record_history(record_id: int, db: Session = Depends(get_db)):
    rec = db.get(DataRecord, record_id)
    if not rec or not rec.annotation:
        return []
    # 按自增 id 倒序：created_at 仅秒级精度，同一秒内的多条日志无法区分先后
    return (
        db.query(ReviewLog)
        .filter(ReviewLog.annotation_id == rec.annotation.id)
        .order_by(ReviewLog.id.desc())
        .all()
    )
