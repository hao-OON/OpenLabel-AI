from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Dataset, QualityIssue
from ..schemas import QualityIssueOut
from ..services.quality import run_quality_check
from .projects import get_project_or_404

router = APIRouter(prefix="/api/quality", tags=["quality"])


@router.post("/{dataset_id}/check", response_model=list[QualityIssueOut])
def check_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    project = get_project_or_404(db, dataset.project_id)
    return run_quality_check(db, dataset_id, project)


@router.get("/{dataset_id}/issues", response_model=list[QualityIssueOut])
def list_issues(
    dataset_id: int, unresolved_only: bool = False, db: Session = Depends(get_db)
):
    query = select(QualityIssue).where(QualityIssue.dataset_id == dataset_id)
    if unresolved_only:
        query = query.where(QualityIssue.resolved == 0)
    return db.scalars(query.order_by(QualityIssue.id.desc())).all()


@router.post("/issues/{issue_id}/resolve", response_model=QualityIssueOut)
def resolve_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.get(QualityIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Issue not found")
    issue.resolved = 1
    db.commit()
    db.refresh(issue)
    return issue
