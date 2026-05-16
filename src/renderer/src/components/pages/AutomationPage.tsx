import React, { useState } from "react";
import { useStoredState } from "../../lib/shared";

interface Automation {
  id: string;
  name: string;
  desc: string;
  status: "active" | "paused";
  trigger: string;
  lastRun: string;
}

const AutomationPage: React.FC = () => {
  const [automations, setAutomations] = useStoredState<Automation[]>(
    "norma-automations",
    [
      {
        id: "1",
        name: "每日文件整理",
        desc: "自动归类下载目录中的文件",
        status: "active",
        trigger: "每天 09:00",
        lastRun: "2小时前",
      },
      {
        id: "2",
        name: "会议纪要生成",
        desc: "监听日历事件，自动生成会议摘要",
        status: "paused",
        trigger: "日历事件",
        lastRun: "3天前",
      },
      {
        id: "3",
        name: "代码审查提醒",
        desc: "检测新 PR 并发送通知",
        status: "active",
        trigger: "GitHub Webhook",
        lastRun: "30分钟前",
      },
    ],
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTrigger, setNewTrigger] = useState("");

  const addAutomation = () => {
    if (!newName.trim()) return;
    const auto: Automation = {
      id: Date.now().toString(),
      name: newName.trim(),
      desc: newDesc.trim() || "新建自动化任务",
      status: "active",
      trigger: newTrigger.trim() || "手动触发",
      lastRun: "从未",
    };
    setAutomations((prev) => [...prev, auto]);
    setNewName("");
    setNewDesc("");
    setNewTrigger("");
    setShowCreate(false);
  };

  const toggleStatus = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status:
                a.status === "active"
                  ? ("paused" as const)
                  : ("active" as const),
            }
          : a,
      ),
    );
  };

  const deleteAutomation = (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90 transition-opacity"
          >
            + 新建自动化
          </button>
          <span className="text-[11px] text-norma-textMuted">
            已启用 {automations.filter((a) => a.status === "active").length} /{" "}
            {automations.length} 个自动化
          </span>
        </div>

        {showCreate && (
          <div className="mb-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="任务名称"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="任务描述"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
            />
            <input
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              placeholder="触发条件 (如: 每天 09:00)"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[11px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={addAutomation}
                className="px-3 py-1 rounded-lg bg-norma-accent text-white text-[11px] hover:opacity-90"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1 rounded-lg bg-white/[0.06] text-norma-textMuted text-[11px] hover:bg-white/[0.1]"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:border-white/[0.1] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => toggleStatus(auto.id)}
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${auto.status === "active" ? "bg-emerald-500" : "bg-white/[0.12]"}`}
                  title={auto.status === "active" ? "点击停用" : "点击启用"}
                >
                  <span
                    className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${auto.status === "active" ? "translate-x-[14px]" : "translate-x-[2px]"}`}
                  />
                </button>
                <span className="text-[12px] font-medium text-norma-text">
                  {auto.name}
                </span>
                <span className="ml-auto text-[9px] text-norma-textDim font-mono">
                  {auto.lastRun}
                </span>
              </div>
              <div className="text-[10px] text-norma-textMuted mb-2">
                {auto.desc}
              </div>
              <div className="flex items-center gap-3 text-[9px] text-norma-textDim">
                <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                  触发: {auto.trigger}
                </span>
                <span
                  className={
                    auto.status === "active"
                      ? "text-emerald-400"
                      : "text-norma-textDim"
                  }
                >
                  {auto.status === "active" ? "运行中" : "已暂停"}
                </span>
                <button
                  onClick={() => deleteAutomation(auto.id)}
                  className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all"
                  title="删除"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { AutomationPage };
