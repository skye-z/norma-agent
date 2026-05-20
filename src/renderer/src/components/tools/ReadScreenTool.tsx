import { makeAssistantToolUI } from "@assistant-ui/react";

export const ReadScreenTool = makeAssistantToolUI({
  toolName: "read_screen",
  component: ({ args, result, status }: any) => {
    const isRunning = status.type === "running";
    const ocrResults = result?.success ? result.ocr_results || [] : [];
    const summary = result?.summary;
    const imageData = result?.image_base64;

    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[13px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : result ? (result.success ? "bg-emerald-400" : "bg-red-400") : "bg-norma-textDim"}`}
          />
          <span className="font-mono text-norma-textMuted">屏幕感知</span>
          <span className="text-norma-textDim ml-auto">
            {isRunning
              ? "识别中..."
              : result
                ? result.success
                  ? `${ocrResults.length} 文本`
                  : "失败"
                : "等待中"}
          </span>
        </div>

        {isRunning && (
          <div className="px-3 py-2 text-norma-textDim">
            正在截取屏幕并识别...
          </div>
        )}

        {result && result.success && (
          <>
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

            {summary && (
              <div className="px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-3 text-norma-textDim">
                {summary.window_title && (
                  <span>
                    窗口:{" "}
                    <span className="text-norma-textMuted">
                      {summary.window_title}
                    </span>
                  </span>
                )}
                <span>{summary.text_count} 个文本元素</span>
              </div>
            )}

            {ocrResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto scrollbar-show">
                <table className="w-full">
                  <tbody>
                    {ocrResults.slice(0, 20).map((m: any, i: number) => (
                      <tr
                        key={i}
                        className="border-t border-white/[0.03] hover:bg-white/[0.02]"
                      >
                        <td className="px-3 py-1 text-norma-textMuted max-w-[200px] truncate">
                          {m.text}
                        </td>
                        <td className="px-3 py-1 text-norma-textDim text-right whitespace-nowrap">
                          ({Math.round(m.x)}, {Math.round(m.y)})
                        </td>
                        <td className="px-3 py-1 text-right">
                          <span
                            className={`text-[12px] ${m.confidence > 0.8 ? "text-emerald-400" : m.confidence > 0.5 ? "text-amber-400" : "text-red-400"}`}
                          >
                            {(m.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {ocrResults.length > 20 && (
                      <tr className="border-t border-white/[0.03]">
                        <td
                          colSpan={3}
                          className="px-3 py-1 text-norma-textDim text-center"
                        >
                          ...还有 {ocrResults.length - 20} 个文本元素
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {result && !result.success && (
          <div className="px-3 py-2 text-red-400/80">
            {result.error || result.message || "截图/OCR失败"}
          </div>
        )}
      </div>
    );
  },
});
