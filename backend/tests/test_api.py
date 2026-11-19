import os
import sys
import tempfile
from io import BytesIO

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_file}")
    monkeypatch.setenv("LLM_API_KEY", "")

    for mod in list(sys.modules):
        if mod.startswith("app"):
            del sys.modules[mod]

    from app.main import app

    with TestClient(app) as c:
        yield c


def create_project(client, labels=None):
    res = client.post(
        "/api/projects", json={"name": "p1", "labels": labels or ["positive", "negative", "neutral"]}
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_full_pipeline(client):
    project = create_project(client)
    ds = client.post("/api/datasets", json={"project_id": project["id"], "name": "d1"}).json()

    csv = (
        "id,text\n"
        '1,"手机外观很好看，但是电池续航太差了。"\n'
        "2,very good product, love it\n"
        "3,very good product, love it\n"
        "4,\n"
        "5,ok\n"
    ).encode("utf-8")
    res = client.post(
        f"/api/datasets/{ds['id']}/import",
        files={"file": ("data.csv", BytesIO(csv), "text/csv")},
    )
    assert res.status_code == 200, res.text
    stats = res.json()
    assert stats["imported"] == 3
    assert stats["skipped"] == 2

    run = client.post("/api/annotations/run", json={"dataset_id": ds["id"], "limit": 100})
    assert run.status_code == 200
    assert run.json()["annotated"] == 3

    records = client.get(f"/api/datasets/{ds['id']}/records?limit=50").json()
    assert len(records) == 3
    assert all(r["ai_label"] in ("positive", "negative", "neutral") for r in records)

    first = records[0]
    review = client.post(
        "/api/annotations/review",
        json={"record_id": first["id"], "action": "modify", "human_label": "negative"},
    )
    assert review.status_code == 200
    assert review.json()["human_label"] == "negative"
    assert review.json()["review_status"] == "modified"

    approval = client.post(
        "/api/annotations/review", json={"record_id": first["id"], "action": "approve"}
    )
    assert approval.status_code == 200
    assert approval.json()["human_label"] == "negative"
    assert approval.json()["review_status"] == "approved"

    reviewed_records = client.get(
        f"/api/datasets/{ds['id']}/records?status=reviewed"
    ).json()
    assert [record["id"] for record in reviewed_records] == [first["id"]]

    history = client.get(f"/api/records/{first['id']}/history").json()
    assert len(history) == 2
    assert history[0]["action"] == "approve"
    assert history[0]["old_label"] == "negative"
    assert history[0]["new_label"] == "negative"

    check = client.post(f"/api/quality/{ds['id']}/check")
    assert check.status_code == 200
    assert any(i["issue_type"] == "duplicate" for i in check.json())

    analytics = client.get(f"/api/analytics/datasets/{ds['id']}").json()
    assert analytics["total"] == 3
    assert analytics["annotated"] == 3
    assert analytics["reviewed"] == 1

    export = client.get(f"/api/datasets/{ds['id']}/export?format=csv&label_source=human")
    assert export.status_code == 200
    assert b"text" in export.content

    dashboard = client.get("/api/analytics/dashboard").json()
    assert dashboard["projects"] == 1
    assert dashboard["records"] == 3


def test_jsonl_import(client):
    project = create_project(client, labels=["a", "b"])
    ds = client.post("/api/datasets", json={"project_id": project["id"], "name": "d2"}).json()
    jsonl = b'{"text": "hello world"}\n{"text": "second sample"}\n'
    res = client.post(
        f"/api/datasets/{ds['id']}/import",
        files={"file": ("data.jsonl", BytesIO(jsonl), "application/x-ndjson")},
    )
    assert res.json()["imported"] == 2


def test_rejects_unsupported_file(client):
    project = create_project(client)
    ds = client.post("/api/datasets", json={"project_id": project["id"], "name": "d3"}).json()
    res = client.post(
        f"/api/datasets/{ds['id']}/import",
        files={"file": ("data.txt", BytesIO(b"abc"), "text/plain")},
    )
    assert res.status_code == 400
