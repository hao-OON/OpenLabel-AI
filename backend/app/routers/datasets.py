from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DataRecord, Dataset, Project
from ..schemas import DatasetCreate, DatasetOut, ImportResult
from ..services.importer import import_dataset
from .projects import get_project_or_404

import csv
import io
import json
from urllib.parse import quote

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=list[DatasetOut])
def list_datasets(project_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Dataset).order_by(Dataset.id.desc())
    if project_id is not None:
        query = query.where(Dataset.project_id == project_id)
    return db.scalars(query).all()


@router.post("", response_model=DatasetOut, status_code=201)
def create_dataset(payload: DatasetCreate, db: Session = Depends(get_db)):
    get_project_or_404(db, payload.project_id)
    dataset = Dataset(**payload.model_dump())
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    return dataset


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    db.delete(dataset)
    db.commit()


@router.post("/{dataset_id}/import", response_model=ImportResult)
def import_file(
    dataset_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    raw = file.file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    try:
        imported, skipped, cleaned, issues = import_dataset(db, dataset, file.filename or "", raw)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return ImportResult(
        dataset_id=dataset_id, imported=imported, skipped=skipped, cleaned=cleaned, issues=issues
    )


@router.get("/{dataset_id}/export")
def export_dataset(
    dataset_id: int,
    format: str = "csv",
    label_source: str = "human",
    db: Session = Depends(get_db),
):
    dataset = db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    records = db.scalars(
        select(DataRecord).where(DataRecord.dataset_id == dataset_id).order_by(DataRecord.row_index)
    ).all()

    fmt = format.lower()
    source = label_source.lower()
    if fmt not in ("csv", "jsonl"):
        raise HTTPException(400, "format must be csv or jsonl")
    if source not in ("human", "ai"):
        raise HTTPException(400, "label_source must be human or ai")

    safe_name = "".join(c for c in dataset.name if c.isalnum() or c in "-_") or "dataset"
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["id", "text", "label", "confidence"])
        for rec in records:
            ann = rec.annotation
            # 严格按来源导出：human 无人工标签时留空，绝不回退到 AI 标签
            label = ann.human_label if (ann and source == "human") else (ann.ai_label if ann else None)
            confidence = ann.ai_confidence if (ann and source == "ai") else None
            writer.writerow([rec.id, rec.text, label or "", confidence if confidence is not None else ""])
        output = buf.getvalue().encode("utf-8-sig")
        media = "text/csv"
        filename = f"{safe_name}.csv"
    else:
        lines = []
        for rec in records:
            ann = rec.annotation
            # 严格按来源导出：human 无人工标签时留空，绝不回退到 AI 标签
            label = ann.human_label if (ann and source == "human") else (ann.ai_label if ann else None)
            item = {"id": rec.id, "text": rec.text, "label": label}
            if source == "ai" and ann and ann.ai_confidence is not None:
                item["confidence"] = ann.ai_confidence
            lines.append(json.dumps(item, ensure_ascii=False))
        output = ("\n".join(lines) + "\n").encode("utf-8")
        media = "application/x-ndjson"
        filename = f"{safe_name}.jsonl"

    return StreamingResponse(
        io.BytesIO(output),
        media_type=media,
        # 非 ASCII 文件名需 percent-encode，避免中文数据集名在响应头中乱码或被丢弃
        headers={"Content-Disposition": f'attachment; filename="{quote(filename)}"'},
    )
