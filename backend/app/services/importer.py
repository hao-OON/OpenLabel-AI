"""Import + cleaning pipeline.

Supports CSV / Excel / JSONL. Text column is auto-detected.
Cleaning: drop empty, strip whitespace, drop duplicates, length checks.
"""

from __future__ import annotations

import csv
import io
import json
import re

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import DataRecord, Dataset, QualityIssue

TEXT_CANDIDATES = ("text", "content", "comment", "review", "sentence", "texts", "body")
MAX_LEN = 10000
MIN_LEN = 2
URL_RE = re.compile(r"https?://\S+")


def _tolerant_csv(raw: bytes, encoding: str) -> pd.DataFrame:
    """Fallback for CSV files with unquoted commas: keep extra fields in a merged column."""
    reader = csv.reader(io.StringIO(raw.decode(encoding, errors="replace")))
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        return pd.DataFrame()
    header = [h.strip() for h in rows[0]]
    width = len(header)
    data = []
    for row in rows[1:]:
        if len(row) > width:
            row = row[: width - 1] + [",".join(row[width - 1 :])]
        elif len(row) < width:
            row = row + [""] * (width - len(row))
        data.append(row)
    return pd.DataFrame(data, columns=header)


def read_frames(filename: str, raw: bytes) -> pd.DataFrame:
    lower = filename.lower()
    if lower.endswith(".csv"):
        for enc in ("utf-8-sig", "utf-8", "gbk", "latin-1"):
            try:
                return pd.read_csv(io.BytesIO(raw), encoding=enc)
            except (UnicodeDecodeError, pd.errors.ParserError):
                pass
        for enc in ("utf-8-sig", "utf-8", "gbk", "latin-1"):
            try:
                df = _tolerant_csv(raw, enc)
                if not df.empty:
                    return df
            except UnicodeDecodeError:
                continue
        raise ValueError("Cannot parse CSV file with supported encodings")
    if lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(raw))
    if lower.endswith(".jsonl"):
        rows = []
        for line in raw.decode("utf-8-sig", errors="replace").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return pd.DataFrame(rows)
    raise ValueError("Unsupported file type. Use CSV, Excel (.xlsx/.xls) or JSONL")


def detect_text_column(df: pd.DataFrame) -> str:
    lowered = {str(c).strip().lower(): c for c in df.columns}
    for cand in TEXT_CANDIDATES:
        if cand in lowered:
            return lowered[cand]
    for col in df.columns:
        if df[col].dtype == object:
            return col
    raise ValueError("No text column found; please include a 'text' column")


def clean_text(value: object) -> str:
    text = "" if value is None or (isinstance(value, float) and pd.isna(value)) else str(value)
    text = URL_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def import_dataset(
    db: Session, dataset: Dataset, filename: str, raw: bytes
) -> tuple[int, int, int, int]:
    df = read_frames(filename, raw)
    if df.empty:
        raise ValueError("File contains no rows")

    col = detect_text_column(df)
    seen: set[str] = set()
    imported = skipped = cleaned = issues = 0
    # 续接数据集已有行号，避免重复导入时 row_index 冲突
    last_row_index = db.scalar(
        select(func.max(DataRecord.row_index)).where(DataRecord.dataset_id == dataset.id)
    )
    row_index = 0 if last_row_index is None else last_row_index + 1

    for value in df[col].tolist():
        raw_text = "" if value is None else str(value)
        text = clean_text(value)
        if text != raw_text.strip():
            cleaned += 1

        if not text:
            skipped += 1
            continue
        if len(text) < MIN_LEN:
            skipped += 1
            issues += 1
            db.add(
                QualityIssue(
                    dataset_id=dataset.id,
                    record_id=None,
                    issue_type="too_short",
                    severity="warning",
                    detail=f"Skipped too-short text: {text[:50]!r}",
                )
            )
            continue
        if text in seen:
            skipped += 1
            issues += 1
            db.add(
                QualityIssue(
                    dataset_id=dataset.id,
                    record_id=None,
                    issue_type="duplicate",
                    severity="warning",
                    detail=f"Skipped duplicate text: {text[:80]!r}",
                )
            )
            continue
        seen.add(text)

        if len(text) > MAX_LEN:
            text = text[:MAX_LEN]
            issues += 1
            db.add(
                QualityIssue(
                    dataset_id=dataset.id,
                    record_id=None,
                    issue_type="too_long",
                    severity="warning",
                    detail="Text truncated to 10000 characters",
                )
            )

        db.add(DataRecord(dataset_id=dataset.id, text=text, row_index=row_index))
        row_index += 1
        imported += 1

    db.flush()  # autoflush=False，需手动 flush 后才能统计到本次新增
    dataset.record_count = (
        db.scalar(
            select(func.count(DataRecord.id)).where(DataRecord.dataset_id == dataset.id)
        )
        or 0
    )
    db.commit()
    return imported, skipped, cleaned, issues
