import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "控制台", end: true },
  { to: "/datasets", label: "数据集" },
  { to: "/annotation", label: "标注审核" },
  { to: "/quality", label: "质量检测" },
  { to: "/analytics", label: "数据分析" },
  { to: "/settings", label: "系统设置" },
];

const navMarks = ["01", "02", "03", "04", "05", "06"];

export default function Layout() {
  return (
    <div className="min-h-screen md:flex">
      <aside className="relative z-10 flex w-full shrink-0 flex-col bg-[#10182c] text-slate-300 md:fixed md:h-full md:w-[184px]">
        <div className="flex items-center gap-2 px-3 py-4 md:py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-brand-400/40 bg-brand-500 text-[10px] font-extrabold text-white shadow-[0_0_18px_rgba(51,99,255,.4)]">
            OL
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide text-white">OpenLabel AI</div>
            <div className="mt-0.5 font-mono text-[9px] tracking-[.18em] text-brand-300">DATA OPS / V1.0</div>
          </div>
        </div>
        <div className="hidden px-3 pb-2 font-mono text-[8px] font-medium tracking-[.12em] text-slate-500 md:block">WORKSPACE</div>
        <nav className="flex flex-1 gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {nav.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-brand-500 text-white shadow-[0_6px_18px_rgba(21,54,167,.4)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="font-mono text-[9px] opacity-60">{navMarks[index]}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="m-2.5 mt-2 hidden rounded-md border border-white/10 bg-white/[.035] p-2.5 md:block">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />SYSTEM ONLINE</div>
          <div className="mt-2 text-[10px] leading-relaxed text-slate-500">AI 标注 · 人工复核<br />数据质量 · 分析洞察</div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:ml-[184px]">
        <div className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/75 px-4 backdrop-blur-sm md:px-6">
          <div className="font-mono text-[10px] font-medium tracking-[.13em] text-slate-400">LABELING INTELLIGENCE PLATFORM</div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500"><span className="h-2 w-2 rounded-full bg-brand-500" />已连接</div>
        </div>
        <div className="mx-auto max-w-[1440px] p-4 md:p-5"><Outlet /></div>
      </main>
    </div>
  );
}
