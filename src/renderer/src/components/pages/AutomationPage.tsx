import React, { useState, useEffect, useCallback } from "react";

interface Automation {
  id: string;
  name: string;
  desc: string;
  status: "idle" | "running" | "completed" | "failed";
  trigger: string;
  lastRun: string;
  lastResult?: string;
}

const AutomationPage: React.FC = () => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTrigger, setNewTrigger] = useState("");

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await window.electronAPI?.automationListWorkflows?.();
      if (res?.success) setWorkflows(res.workflows || []);
    } catch {}
  }, []);

  const fetchAutomations = useCallback(async () => {
    try {
      const stored = await (window as any).electronAPI?.configGet?.("norma-automations");
      if (stored && Array.isArray(stored)) setAutomations(stored);
    } catch {}
  }, []);

  useEffect(() => { fetchWorkflows(); fetchAutomations(); }, [fetchWorkflows, fetchAutomations]);

  const saveAutomations = (items: Automation[]) => {
    setAutomations(items);
    (window as any).electronAPI?.configSet?.("norma-automations", items).catch(() => {});
  };

  const addAutomation = () => {
    if (!newName.trim()) return;
    const auto: Automation = {
      id: Date.now().toString(),
      name: newName.trim(),
      desc: newDesc.trim() || "新建自动化任务",
      status: "idle",
      trigger: newTrigger.trim() || "手动触发",
      lastRun: "从未",
    };
    saveAutomations([...automations, auto]);
    setNewName("");
    setNewDesc("");
    setNewTrigger("");
    setShowCreate(false);
  };

  const runAutomation = async (auto: Automation) => {
    setAutomations((prev) =>
      prev.map((a) => a.id === auto.id ? { ...a, status: "running" as const } : a),
    );
    try {
      const res = await window.electronAPI?.automationRun?.(auto.name, auto.desc, auto.trigger);
      const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      if (res?.success) {
        setAutomations((prev) =>
          prev.map((a) => a.id === auto.id ? {
            ...a,
            status: "completed" as const,
            lastRun: now,
            lastResult: res.output,
          } : a),
        );
      } else {
        setAutomations((prev) =>
          prev.map((a) => a.id === auto.id ? {
            ...a,
            status: "failed" as const,
            lastRun: now,
            lastResult: res?.error || "执行失败",
          } : a),
        );
      }
    } catch (err: any) {
      setAutomations((prev) =>
        prev.map((a) => a.id === auto.id ? { ...a, status: "failed" as const, lastResult: err.message } : a),
      );
    }
  };

  const toggleStatus = (id: string) => {
    saveAutomations(automations.map((a) =>
      a.id === id ? { ...a, status: a.status === "idle" ? "completed" as const : "idle" as const } : a,
    ));
  };

  const deleteAutomation = (id: string) => {
    saveAutomations(automations.filter((a) => a.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex-1 overflow-y-auto scrollbar-show px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-lg bg-norma-accent text-white text-[13px] hover:opacity-90 transition-opacity"
            >
              + 新建自动化
            </button>
            {workflows.length > 0 && (
              <span className="text-[12px] text-norma-textDim">
                {workflows.length} 个 Mastra 工作流可用
              </span>
            )}
          </div>
          <span className="text-[13px] text-norma-textMuted">
            {automations.length} 个自动化
          </span>
        </div>

        {showCreate && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); setNewTrigger(""); }}>
            <div className="w-[480px] max-h-[70vh] rounded-2xl bg-[#1c1c20] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[15px] font-medium text-norma-text flex-1">新建自动化任务</span>
                <button
                  onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); setNewTrigger(""); }}
                  className="p-1 rounded hover:bg-white/[0.06] text-norma-textMuted hover:text-norma-text transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-show p-4 space-y-3">
                <div>
                  <div className="text-[12px] text-norma-textDim mb-1">任务名称</div>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="输入任务名称"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
                  />
                </div>
                <div>
                  <div className="text-[12px] text-norma-textDim mb-1">任务描述</div>
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="描述自动化任务的目标"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
                  />
                </div>
                <div>
                  <div className="text-[12px] text-norma-textDim mb-1">触发条件</div>
                  <input
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                    placeholder="如: 每天 09:00, 手动触发"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] text-norma-text placeholder-norma-textDim outline-none focus:border-norma-accent/40"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
                <button
                  onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); setNewTrigger(""); }}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-norma-textMuted text-[13px] hover:bg-white/[0.1] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={addAutomation}
                  disabled={!newName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-norma-accent text-white text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  创建
                </button>
              </div>
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
                  className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${auto.status !== "idle" ? "bg-emerald-500" : "bg-white/[0.12]"}`}
                  title={auto.status !== "idle" ? "点击停用" : "点击启用"}
                >
                  <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${auto.status !== "idle" ? "translate-x-[14px]" : "translate-x-[2px]"}`} />
                </button>
                <span className="text-[14px] font-medium text-norma-text">
                  {auto.name}
                </span>
                <span className="ml-auto text-[11px] text-norma-textDim font-mono">
                  {auto.lastRun}
                </span>
              </div>
              <div className="text-[12px] text-norma-textMuted mb-2">
                {auto.desc}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-norma-textDim">
                <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                  触发: {auto.trigger}
                </span>
                <span className={auto.status === "running" ? "text-amber-400" : auto.status === "completed" ? "text-emerald-400" : auto.status === "failed" ? "text-red-400" : "text-norma-textDim"}>
                  {auto.status === "running" ? "执行中" : auto.status === "completed" ? "已完成" : auto.status === "failed" ? "失败" : "空闲"}
                </span>
                <button
                  onClick={() => runAutomation(auto)}
                  disabled={auto.status === "running"}
                  className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
                >
                  {auto.status === "running" ? "执行中..." : "运行"}
                </button>
                {auto.lastResult && (
                  <span className="truncate max-w-[200px]" title={auto.lastResult}>
                    {auto.lastResult}
                  </span>
                )}
                <button
                  onClick={() => deleteAutomation(auto.id)}
                  className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all"
                  title="删除"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {automations.length === 0 && (
            <div className="text-[13px] text-norma-textDim text-center py-8">
              暂无自动化任务，点击"新建自动化"创建
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { AutomationPage };
