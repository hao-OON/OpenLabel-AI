import { useEffect, useState } from "react";
import { api } from "../api";
import type { Dashboard as DashboardData } from "../types";
import { Link } from "react-router-dom";

const cards: { key: keyof DashboardData; label: string; hint: string; tone: string; bar: string }[] = [
  { key: "projects", label: "项目空间", hint: "PROJECTS", tone: "text-brand-600", bar: "bg-brand-600" },
  { key: "datasets", label: "数据集", hint: "DATASETS", tone: "text-violet-600", bar: "bg-violet-600" },
  { key: "records", label: "样本资产", hint: "RECORDS", tone: "text-cyan-600", bar: "bg-cyan-600" },
  { key: "annotated", label: "AI 已标注", hint: "ANNOTATED", tone: "text-emerald-600", bar: "bg-emerald-600" },
  { key: "reviewed", label: "人工已审核", hint: "REVIEWED", tone: "text-sky-600", bar: "bg-sky-600" },
  { key: "pending_review", label: "待审核队列", hint: "PENDING", tone: "text-amber-600", bar: "bg-amber-600" },
  { key: "open_issues", label: "待处理问题", hint: "OPEN ISSUES", tone: "text-rose-600", bar: "bg-rose-600" },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<DashboardData>("/analytics/dashboard").then(setData).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">CONTROL CENTER / 01</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">数据标注控制台</h1>
          <p className="mt-2 text-sm text-slate-500">集中查看数据资产、审核进度与质量风险。</p>
        </div>
        <Link className="btn-primary" to="/annotation">进入审核工作台</Link>
      </header>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className="card relative overflow-hidden">
            <div className={`absolute right-3 top-3 font-mono text-[9px] font-bold tracking-wider ${c.tone}`}>{c.hint}</div>
            <div className="text-xs font-semibold text-slate-500">{c.label}</div>
            <div className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
              {data ? data[c.key] : "—"}
            </div>
            <div className={`mt-3 h-1 w-8 rounded-full ${c.bar}`} />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card border-brand-100 bg-gradient-to-br from-white to-brand-50/70">
          <div className="section-kicker">NEXT ACTION</div>
          <h2 className="text-lg font-extrabold text-slate-900">让数据流转起来</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">创建项目并导入数据后，系统即可运行 AI 标注。低置信度样本会优先进入人工审核队列。</p>
          <div className="mt-5 flex flex-wrap gap-2"><Link className="btn-primary" to="/datasets">管理数据集</Link><Link className="btn-secondary" to="/quality">检查数据质量</Link></div>
        </section>
        <section className="card">
          <div className="section-kicker">WORKFLOW</div>
          <div className="space-y-3">{["导入并清洗原始数据", "运行 AI 初步标注", "审核低置信度样本", "分析标签与质量趋势"].map((text, index) => <div key={text} className="flex items-center gap-3 text-xs font-semibold text-slate-600"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] text-brand-600">0{index + 1}</span>{text}</div>)}</div>
        </section>
      </div>
    </div>
  );
}
