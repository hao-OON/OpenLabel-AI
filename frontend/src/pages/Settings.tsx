import { useEffect, useState } from "react";
import { api } from "../api";
import type { AppSettings } from "../types";

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<AppSettings>("/settings").then(setSettings).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">模型与 API 配置</p>
      </header>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <div className="card max-w-2xl space-y-4">
        <h2 className="text-base font-semibold">AI 模型</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="label">服务模式</div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {settings?.mode === "llm" ? "OpenAI 兼容 API" : "本地启发式（离线可用）"}
            </div>
          </div>
          <div>
            <div className="label">模型</div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {settings?.llm_model ?? "—"}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="label">API Base URL</div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {settings?.llm_base_url ?? "—"}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="label">API Key</div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {settings?.llm_api_key_set ? "已配置（环境变量 LLM_API_KEY）" : "未配置"}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          V1 通过环境变量配置模型。在 <code className="rounded bg-slate-100 px-1">backend/.env</code> 中设置
          <code className="mx-1 rounded bg-slate-100 px-1">LLM_API_KEY</code>、
          <code className="mx-1 rounded bg-slate-100 px-1">LLM_BASE_URL</code>、
          <code className="mx-1 rounded bg-slate-100 px-1">LLM_MODEL</code> 后重启后端即可切换到大模型；
          未配置时自动使用本地启发式标注，保证系统开箱可用。
        </p>
      </div>
    </div>
  );
}
