import { useEffect, useState } from "react";
import { api } from "../api";
import type { QualityIssue } from "../types";
import { DatasetSelect, useDatasets, useLocalDataset } from "../hooks";

const issueLabels: Record<string, string> = {
  duplicate: "重复样本",
  too_short: "文本过短",
  too_long: "文本过长",
  low_confidence: "低置信度",
  label_mismatch: "标签异常",
  ai_human_disagree: "AI/人工不一致",
  label_imbalance: "标签分布失衡",
};

export default function Quality() {
  const { datasets } = useDatasets();
  const [datasetId, setDatasetId] = useLocalDataset();
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // datasetId 为空，或指向已删除的数据集时，自动回退到第一个有效数据集
    if (!datasetId || !datasets.some((d) => d.id === datasetId)) {
      if (datasets.length) setDatasetId(datasets[0].id);
    }
  }, [datasets, datasetId, setDatasetId]);

  const load = () => {
    if (!datasetId) return;
    api
      .get<QualityIssue[]>(`/quality/${datasetId}/issues?unresolved_only=${unresolvedOnly}`)
      .then(setIssues)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, [datasetId, unresolvedOnly]);

  const runCheck = async () => {
    if (!datasetId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post<QualityIssue[]>(`/quality/${datasetId}/check`);
      setMessage(`质量检测完成，发现 ${res.length} 个问题`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id: number) => {
    await api.post(`/quality/issues/${id}/resolve`);
    load();
  };

  const grouped = issues.reduce<Record<string, QualityIssue[]>>((acc, issue) => {
    (acc[issue.issue_type] ||= []).push(issue);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Quality</h1>
          <p className="mt-1 text-sm text-slate-500">低置信度、重复样本与标签异常检测</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatasetSelect value={datasetId} onChange={setDatasetId} datasets={datasets} className="!w-64" />
          <button className="btn-primary" disabled={!datasetId || busy} onClick={runCheck}>
            {busy ? "检测中…" : "运行质量检测"}
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className={`card text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || message}</div>
      )}

      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={unresolvedOnly}
            onChange={(e) => setUnresolvedOnly(e.target.checked)}
          />
          仅显示未解决
        </label>
        <span className="text-slate-400">共 {issues.length} 条问题记录</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{issueLabels[type] ?? type}</h3>
              <span className="badge bg-slate-100 text-slate-600">{items.length}</span>
            </div>
            <ul className="space-y-2">
              {items.slice(0, 8).map((issue) => (
                <li key={issue.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className={issue.severity === "error" ? "text-red-600" : "text-amber-600"}>
                      {issue.severity}
                    </span>
                    <span className="text-slate-400">
                      {issue.record_id ? `样本 #${issue.record_id}` : "数据集级"}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-600">{issue.detail}</div>
                  {!issue.resolved && (
                    <button className="mt-1 text-brand-600 underline" onClick={() => resolve(issue.id)}>
                      标记已解决
                    </button>
                  )}
                </li>
              ))}
              {items.length > 8 && (
                <li className="text-xs text-slate-400">… 还有 {items.length - 8} 条</li>
              )}
            </ul>
          </div>
        ))}
        {!issues.length && (
          <div className="card text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            {datasetId ? "暂无质量问题，先运行一次质量检测。" : "请先选择数据集。"}
          </div>
        )}
      </div>
    </div>
  );
}
