import { makeAssistantToolUI } from "@assistant-ui/react";

export const ExecuteActionTool = makeAssistantToolUI({
  toolName: "execute_action",
  component: ({ args, result, status }: any) => {
    const isRunning = status.type === "running";
    const actions: any[] = args?.actions || [];
    const results: any[] = result?.results || [];
    const actionLabels = actions.map((a: any) => {
      if (a.type === 'mouse') return a.action;
      if (a.type === 'keyboard') return a.action;
      return a.type;
    });
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[13px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : result ? (result.success ? "bg-emerald-400" : "bg-red-400") : "bg-norma-textDim"}`}
          />
          <span className="font-mono text-norma-textMuted">execute_action</span>
          {actionLabels.length > 0 && (
            <span className="text-norma-textDim truncate max-w-[200px]">
              {actionLabels.join(' → ')}
            </span>
          )}
          <span className="text-norma-textDim ml-auto">
            {isRunning ? `执行中 (${actionLabels.length})...` : result ? (result.success ? "完成" : "部分失败") : "等待中"}
          </span>
        </div>
        {isRunning && (
          <div className="px-3 py-2 text-norma-textDim">
            正在执行 {actionLabels.length} 个操作...
          </div>
        )}
        {results.length > 0 && (
          <div className="px-3 py-2 space-y-1">
            {results.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-1 h-1 rounded-full ${r.success ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-norma-text/80">{r.detail || r.action}</span>
                {r.error && <span className="text-red-400/80">({r.error})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
});
