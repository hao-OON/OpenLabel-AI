import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type {
  AnnotateResult,
  Dataset,
  Project,
  RecordItem,
  ReviewLog,
} from "../types";
import { DatasetSelect, useDatasets, useLocalDataset } from "../hooks";

type Filter = "low_confidence" | "pending" | "all" | "flagged" | "reviewed";

const filters: { key: Filter; label: string }[] = [
  { key: "low_confidence", label: "低置信度优先" },
  { key: "pending", label: "待审核" },
  { key: "all", label: "全部样本" },
  { key: "reviewed", label: "已审核" },
  { key: "flagged", label: "已标记异常" },
];

const statusText: Record<string, string> = {
  pending: "待人工审核",
  approved: "已确认",
  modified: "已修改",
  flagged: "已标记异常",
  unannotated: "未标注",
};

export default function Annotation() {
  const { datasets } = useDatasets();
  const [datasetId, setDatasetId] = useLocalDataset();
  const [project, setProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState<Filter>("low_confidence");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [history, setHistory] = useState<ReviewLog[]>([]);
  const [limit, setLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // datasetId 为空，或指向已删除的数据集时，自动回退到第一个有效数据集
    if (!datasetId || !datasets.some((d) => d.id === datasetId)) {
      if (datasets.length) setDatasetId(datasets[0].id);
    }
  }, [datasets, datasetId, setDatasetId]);

  useEffect(() => {
    if (!datasetId) return;
    api.get<Dataset>(`/datasets/${datasetId}`).then((d) =>
      api.get<Project>(`/projects/${d.project_id}`).then(setProject)
    );
  }, [datasetId]);

  const loadRecords = () => {
    if (!datasetId) return;
    const status = filter === "all" ? "" : `&status=${filter}`;
    api
      .get<RecordItem[]>(`/datasets/${datasetId}/records?limit=200${status}`)
      .then((rs) => {
        // 后端已按筛选条件排好序（low_confidence 按置信度升序），直接使用
        setRecords(rs);
        setSelected((cur) => rs.find((r) => r.id === cur?.id) ?? rs[0] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(loadRecords, [datasetId, filter]);

  useEffect(() => {
    if (!selected) return setHistory([]);
    api
      .get<ReviewLog[]>(`/records/${selected.id}/history`)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [selected?.id, selected?.review_status, selected?.human_label]);

  const labels = project?.labels ?? ["positive", "negative", "neutral"];
  const counts = useMemo(() => {
    const pending = records.filter((r) => r.review_status === "pending").length;
    const low = records.filter(
      (r) => r.review_status === "pending" && (r.ai_confidence ?? 1) < 0.6
    ).length;
    return { pending, low };
  }, [records]);

  const runAi = async () => {
    if (!datasetId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AnnotateResult>("/annotations/run", {
        dataset_id: datasetId,
        limit,
        only_pending: true,
      });
      setMessage(
        `AI 标注完成：成功 ${res.annotated} 条，失败 ${res.failed} 条（模式：${
          res.mode === "llm" ? "大模型 API" : "本地启发式"
        }）`
      );
      loadRecords();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const review = async (action: "approve" | "modify" | "flag", humanLabel?: string) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.post<RecordItem>("/annotations/review", {
        record_id: selected.id,
        action,
        human_label: humanLabel ?? null,
        reviewer: "reviewer",
      });
      setMessage(`样本 #${selected.id} ${statusText[updated.review_status]}`);
      // 审核后记录不再属于当前筛选队列（如 low_confidence / pending），
      // 从列表移除并自动跳到下一条，避免队列中残留已审核样本
      const idx = records.findIndex((r) => r.id === updated.id);
      setRecords((rs) => rs.filter((r) => r.id !== updated.id));
      setSelected(records[idx + 1] ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="annotation-page space-y-2.5 text-[13px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Annotation</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            AI 标注与人工复核工作台 · 低置信度样本优先进入队列
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatasetSelect value={datasetId} onChange={setDatasetId} datasets={datasets} className="!w-64" />
          <select className="input !w-32" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[20, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>本次 {n} 条</option>
            ))}
          </select>
          <button className="btn-primary" disabled={!datasetId || busy} onClick={runAi}>
            {busy ? "处理中…" : "运行 AI 标注"}
          </button>
        </div>
      </header>

      {(message || error) && (
        <div className={`card text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>
          {error || message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">
          待审核 {counts.pending} · 低置信度 {counts.low} · 共 {records.length} 条
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="card !p-0">
          <div className="max-h-[42vh] divide-y divide-slate-100 overflow-y-auto md:max-h-[calc(100vh-210px)]">
            {records.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition hover:bg-slate-50 ${
                  selected?.id === r.id ? "bg-brand-50" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>样本 #{String(r.id).padStart(6, "0")}</span>
                    <span className={`badge ${badgeClass(r.review_status)}`}>
                      {statusText[r.review_status] ?? r.review_status}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-[13px] text-slate-700">{r.text}</div>
                </div>
                <div className="shrink-0 space-y-1 text-right text-[11px]">
                  <div className="font-medium text-slate-500">
                    <span className="mr-1 text-slate-400">AI：</span>
                    <span className="text-slate-700">{r.ai_label ?? "未标注"}</span>
                    {r.ai_confidence != null && (
                      <span className={`ml-1 tabular-nums ${(r.ai_confidence ?? 1) < 0.6 ? "text-amber-600" : "text-slate-400"}`}>
                        {Math.round(r.ai_confidence * 100)}%
                      </span>
                    )}
                  </div>
                  {r.human_label && (
                    <div className="font-semibold text-emerald-700">
                      <span className="mr-1 text-emerald-600/70">人工：</span>{r.human_label}
                    </div>
                  )}
                </div>
              </button>
            ))}
            {!records.length && (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                {datasetId ? "当前筛选下没有样本，试试运行 AI 标注或切换筛选。" : "请先选择数据集。"}
              </div>
            )}
          </div>
        </section>

        <section className="card space-y-2.5">
          {!selected && <div className="text-sm text-slate-400">从左侧选择一条样本开始审核。</div>}
          {selected && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">
                    样本 #{String(selected.id).padStart(6, "0")}
                  </div>
                  <div className={`mt-1 badge ${badgeClass(selected.review_status)}`}>
                    {statusText[selected.review_status] ?? selected.review_status}
                  </div>
                </div>
                {selected.is_flagged && <span className="badge bg-red-100 text-red-700">异常标记</span>}
              </div>

              <div>
                <div className="label">用户评论</div>
                <div className="rounded-md bg-slate-50 p-2 text-[13px] leading-relaxed text-slate-700">
                  {selected.text}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs text-slate-400">AI 推荐标签</div>
                  <div className="mt-1 text-lg font-semibold">{selected.ai_label ?? "未标注"}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs text-slate-400">置信度</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {selected.ai_confidence != null
                      ? `${Math.round(selected.ai_confidence * 100)}%`
                      : "—"}
                  </div>
                </div>
              </div>

              {selected.ai_reason && (
                <div>
                  <div className="label">识别原因</div>
                  <div className="text-sm text-slate-600">{selected.ai_reason}</div>
                </div>
              )}

              {selected.human_label && (
                <div>
                  <div className="label">人工标签</div>
                  <span className="badge bg-emerald-100 text-emerald-700">{selected.human_label}</span>
                </div>
              )}

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="label">人工审核操作</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    disabled={busy || !selected.ai_label}
                    onClick={() => review("approve")}
                  >
                    确认标签
                  </button>
                  <button
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => review("flag")}
                  >
                    标记异常
                  </button>
                </div>
                <div>
                  <div className="label mt-2">修改标签</div>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((l) => (
                      <button
                        key={l}
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => review("modify", l)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {history.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="label">审核历史</div>
                  <ul className="space-y-1 text-xs text-slate-500">
                    {history.map((h) => (
                      <li key={h.id}>
                        {new Date(h.created_at + "Z").toLocaleString()} · {h.action}
                        {h.old_label ? ` · ${h.old_label}` : ""}
                        {h.new_label ? ` → ${h.new_label}` : ""} · {h.reviewer}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function badgeClass(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "modified":
      return "bg-blue-100 text-blue-700";
    case "flagged":
      return "bg-red-100 text-red-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
