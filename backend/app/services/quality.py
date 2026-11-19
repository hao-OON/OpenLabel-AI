"""Rule-based quality inspection over a dataset's annotations."""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Annotation, DataRecord, Project, QualityIssue

LOW_CONFIDENCE = 0.6

# 这些问题只由运行时检测生成；导入阶段记录的重复、过短、截断问题需要保留。
RECHECKED_ISSUE_TYPES = {
    "low_confidence",
    "label_mismatch",
    "ai_human_disagree",
    "label_imbalance",
}


def run_quality_check(db: Session, dataset_id: int, project: Project) -> list[QualityIssue]:
    records = db.scalars(select(DataRecord).where(DataRecord.dataset_id == dataset_id)).all()
    annotations = db.scalars(
        select(Annotation).join(DataRecord).where(DataRecord.dataset_id == dataset_id)
    ).all()
    ann_by_record = {a.record_id: a for a in annotations}
    labels = set(project.labels or [])

    # synchronize_session=False：批量删除不同步 session 缓存，性能更好；
    # 此处安全因为随后立即 db.flush() + 重新查询，不会访问已删除对象的属性
    db.query(QualityIssue).filter(
        QualityIssue.dataset_id == dataset_id,
        QualityIssue.resolved == 0,
        QualityIssue.issue_type.in_(RECHECKED_ISSUE_TYPES),
    ).delete(synchronize_session=False)
    db.flush()

    created: list[QualityIssue] = []

    def add(record_id: int | None, issue_type: str, detail: str, severity: str = "warning"):
        issue = QualityIssue(
            dataset_id=dataset_id,
            record_id=record_id,
            issue_type=issue_type,
            severity=severity,
            detail=detail,
        )
        db.add(issue)
        created.append(issue)

    text_seen: dict[str, int] = {}
    for rec in records:
        key = rec.text.strip().lower()
        if key in text_seen:
            add(rec.id, "duplicate", f"Duplicate of record #{text_seen[key]}")
        else:
            text_seen[key] = rec.id

        if len(rec.text.strip()) < 5:
            add(rec.id, "too_short", "Text shorter than 5 characters")

        ann = ann_by_record.get(rec.id)
        if not ann:
            continue
        if ann.ai_confidence is not None and ann.ai_confidence < LOW_CONFIDENCE:
            add(rec.id, "low_confidence", f"AI confidence {ann.ai_confidence:.2f} below threshold")
        if ann.ai_label and ann.ai_label not in labels:
            add(rec.id, "label_mismatch", f"AI label '{ann.ai_label}' not in project labels")
        if ann.human_label and ann.human_label not in labels:
            add(rec.id, "label_mismatch", f"Human label '{ann.human_label}' not in project labels")
        if ann.human_label and ann.ai_label and ann.human_label != ann.ai_label:
            add(rec.id, "ai_human_disagree", "Human label differs from AI label")

    by_label: dict[str, list[int]] = defaultdict(list)
    for ann in annotations:
        if ann.ai_label:
            by_label[ann.ai_label].append(ann.record_id)
    total = max(len(annotations), 1)
    for label, ids in by_label.items():
        ratio = len(ids) / total
        if ratio > 0.9 and len(annotations) >= 10:
            add(None, "label_imbalance", f"Label '{label}' covers {ratio:.0%} of annotations")

    db.commit()
    return db.scalars(
        select(QualityIssue)
        .where(QualityIssue.dataset_id == dataset_id, QualityIssue.resolved == 0)
        .order_by(QualityIssue.id.desc())
    ).all()
