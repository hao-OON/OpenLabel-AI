import { useEffect, useState, type ReactNode } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import type { Analytics } from "../types";
import { DatasetSelect, useDatasets, useLocalDataset } from "../hooks";

export default function Analytics() {
  const { datasets } = useDatasets();
  const [datasetId, setDatasetId] = useLocalDataset();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // datasetId 为空，或指向已删除的数据集时，自动回退到第一个有效数据集
    if (!datasetId || !datasets.some((d) => d.id === datasetId)) {
      if (datasets.length) setDatasetId(datasets[0].id);
    }
  }, [datasets, datasetId, setDatasetId]);

  useEffect(() => {
    if (!datasetId) return;
    setData(null);
    api
      .get<Analytics>(`/analytics/datasets/${datasetId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [datasetId]);

  if (error) return <div className="card text-sm text-red-600">{error}</div>;

  const agreementPct =
    data?.ai_human_agreement != null ? Math.round(data.ai_human_agreement * 100) : null;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">标签分布 · 审核统计 · 准确率</p>
        </div>
        <DatasetSelect value={datasetId} onChange={setDatasetId} datasets={datasets} className="!w-64" />
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="样本总数" value={data?.total} />
        <Stat title="已标注" value={data?.annotated} />
        <Stat title="已审核" value={data?.reviewed} />
        <Stat title="待审核" value={data?.pending_review} />
        <Stat title="低置信度" value={data?.low_confidence} />
        <Stat title="标记异常" value={data?.flagged} />
        <Stat title="AI/人工一致率" value={agreementPct != null ? `${agreementPct}%` : undefined} />
        <Stat title="人工标签数" value={data?.human_distribution.reduce((s, d) => s + d.count, 0)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-base font-semibold">AI 标签分布</h2>
          <ChartHeight>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.ai_distribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3363ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartHeight>
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-semibold">人工标签分布</h2>
          <ChartHeight>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.human_distribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartHeight>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-semibold">审核员统计</h2>
        {data?.reviewer_stats.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2">审核员</th>
                <th className="py-2">审核次数</th>
              </tr>
            </thead>
            <tbody>
              {data.reviewer_stats.map((r) => (
                <tr key={r.reviewer} className="border-b border-slate-100">
                  <td className="py-2">{r.reviewer}</td>
                  <td className="py-2 tabular-nums">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-sm text-slate-400">暂无审核记录</div>
        )}
      </div>
    </div>
  );
}

function ChartHeight({ children }: { children: ReactNode }) {
  return <div className="h-64">{children}</div>;
}

function Stat({ title, value }: { title: string; value?: number | string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value ?? "—"}</div>
    </div>
  );
}
