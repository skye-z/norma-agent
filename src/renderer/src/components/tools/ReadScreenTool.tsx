import { makeAssistantToolUI } from "@assistant-ui/react";

export const ReadScreenTool = makeAssistantToolUI({
  toolName: "read_screen",
  component: ({ args, result, status }: any) => {
    const isRunning = status.type === "running";
    const imageData = result?.success ? result.image_base64 : null;
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : result ? (result.success ? "bg-emerald-400" : "bg-red-400") : "bg-norma-textDim"}`}
          />
          <span className="font-mono text-norma-textMuted">read_screen</span>
          {args?.reason && (
            <span className="text-norma-textDim truncate max-w-[200px]">
              {args.reason}
            </span>
          )}
          <span className="text-norma-textDim ml-auto">
            {isRunning ? "截屏中..." : result ? (result.success ? "完成" : "失败") : "等待中"}
          </span>
        </div>
        {isRunning && (
          <div className="px-3 py-2 text-norma-textDim">
            正在截取屏幕内容...
          </div>
        )}
        {imageData && (
          <div className="px-2 py-2">
            <img
              src={`data:image/png;base64,${imageData}`}
              alt="屏幕截图"
              className="w-full rounded-lg border border-white/[0.06] opacity-90"
              style={{ maxHeight: 200, objectFit: "cover" }}
            />
          </div>
        )}
        {result && !result.success && (
          <div className="px-3 py-2 text-red-400/80">
            {result.error || result.message || "截图失败"}
          </div>
        )}
      </div>
    );
  },
});
