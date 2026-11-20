import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { ImportResult, Project } from "../types";
import { useDatasets } from "../hooks";

export default function Datasets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [labelsText, setLabelsText] = useState("positive, negative, neutral");
  const [datasetName, setDatasetName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);

  const { datasets, reload } = useDatasets();

  const loadProjects = () => {
    api.get<Project[]>("/projects").then((ps) => {
      setProjects(ps);
      if (ps.length && activeProject === null) setActiveProject(ps[0].id);
    });
  };

  useEffect(loadProjects, []);

  const createProject = async () => {
    setError("");
    if (!projectName.trim()) return setError("请输入项目名称");
    const labels = labelsText.split(",").map((l) => l.trim()).filter(Boolean);
    try {
      const p = await api.post<Project>("/projects", {
        name: projectName.trim(),
        labels,
        task_type: "sentiment",
      });
      setProjectName("");
      setActiveProject(p.id);
      loadProjects();
      setMessage(`项目「${p.name}」创建成功`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm("删除项目会同时删除其数据集与标注，确定继续？")) return;
    await api.del(`/projects/${id}`);
    loadProjects();
    reload();
    // 若删除的正是当前选中项目，回退到剩余第一个项目，避免创建数据集时提交无效 project_id
    if (activeProject === id) {
      setActiveProject(projects.find((p) => p.id !== id)?.id ?? null);
    }
  };

  const createDataset = async () => {
    setError("");
    if (!activeProject) return setError("请先创建项目");
    if (!datasetName.trim()) return setError("请输入数据集名称");
    try {
      await api.post("/datasets", { project_id: activeProject, name: datasetName.trim() });
      setDatasetName("");
      reload();
      setMessage("数据集创建成功");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteDataset = async (id: number) => {
    if (!confirm("确定删除该数据集？")) return;
    await api.del(`/datasets/${id}`);
    reload();
  };

  const onPickFile = (id: number) => {
    setUploadTarget(id);
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadTarget) return;
    setError("");
    try {
      const res = await api.upload<ImportResult>(`/datasets/${uploadTarget}/import`, file);
      setMessage(
        `导入完成：新增 ${res.imported} 条，跳过 ${res.skipped} 条，清洗 ${res.cleaned} 条，问题 ${res.issues} 个`
      );
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Datasets</h1>
          <p className="mt-1 text-sm text-slate-500">项目与数据集管理 · 支持 CSV / Excel / JSONL</p>
        </div>
      </header>

      {(message || error) && (
        <div className={`card text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="text-base font-semibold">新建项目</h2>
          <div>
            <label className="label">项目名称</label>
            <input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="例如：电商评论情感分析" />
          </div>
          <div>
            <label className="label">标签体系（逗号分隔）</label>
            <input className="input" value={labelsText} onChange={(e) => setLabelsText(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={createProject}>创建项目</button>

          <div className="border-t border-slate-100 pt-3">
            <div className="mb-2 text-sm font-medium text-slate-600">已有项目</div>
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    activeProject === p.id ? "border-brand-300 bg-brand-50" : "border-slate-200"
                  }`}
                >
                  <button className="text-left" onClick={() => setActiveProject(p.id)}>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">标签：{p.labels.join(" / ")}</div>
                  </button>
                  <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => deleteProject(p.id)}>
                    删除
                  </button>
                </div>
              ))}
              {!projects.length && <div className="text-sm text-slate-400">暂无项目</div>}
            </div>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="text-base font-semibold">新建数据集</h2>
          <div>
            <label className="label">所属项目</label>
            <select
              className="input"
              value={activeProject ?? ""}
              onChange={(e) => setActiveProject(Number(e.target.value))}
            >
              <option value="" disabled>请选择项目…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">数据集名称</label>
            <input className="input" value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="例如：手机评论-第一批" />
          </div>
          <button className="btn-primary" onClick={createDataset}>创建数据集</button>
        </section>
      </div>

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">数据集列表</h2>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.jsonl" className="hidden" onChange={onFileChange} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">名称</th>
                <th className="py-2 pr-3">项目</th>
                <th className="py-2 pr-3">样本数</th>
                <th className="py-2 pr-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-400">#{d.id}</td>
                  <td className="py-2 pr-3 font-medium">{d.name}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {projects.find((p) => p.id === d.project_id)?.name ?? d.project_id}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{d.record_count}</td>
                  <td className="flex gap-2 py-2 pr-3">
                    <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => onPickFile(d.id)}>
                      导入文件
                    </button>
                    <a className="btn-secondary !px-2 !py-1 text-xs" href={api.exportUrl(d.id, "csv", "human")}>
                      导出 CSV
                    </a>
                    <a className="btn-secondary !px-2 !py-1 text-xs" href={api.exportUrl(d.id, "jsonl", "human")}>
                      导出 JSONL
                    </a>
                    <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => deleteDataset(d.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {!datasets.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">暂无数据集</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
