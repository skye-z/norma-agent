import React, { useState } from "react";

export function extractErrorMessage(result: unknown, _depth = 0): string {
  if (typeof result === "string") {
    if (_depth > 2) return result;
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed === "object" && parsed !== null)
        return extractErrorMessage(parsed, _depth + 1);
    } catch {}
    return result;
  }
  if (!result || typeof result !== "object") return String(result);
  if (result instanceof Error) return result.message;
  const obj = result as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object") {
    return extractErrorMessage(obj.error, _depth + 1);
  }
  const { success, timestamp, ...rest } = obj;
  const keys = Object.keys(rest);
  if (keys.length <= 3) {
    const parts = keys
      .map((k) => {
        const v = rest[k];
        if (typeof v === "string") return v;
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return String(v);
        return null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

import {
  useMessage,
  useMessagePartFile,
  useMessagePartImage,
  AttachmentPrimitive,
} from "@assistant-ui/react";
import { getToolLabel } from "../../lib/tool-registry";
import { getMessageMeta } from "../../lib/ipc-chat";

export const MessageMetaDisplay: React.FC = () => {
  const [showInfo, setShowInfo] = useState(false);
  const message = useMessage();
  const msgIdx = (message as any).index ?? 0;
  const meta = getMessageMeta(msgIdx) ?? (message as any).metadata?.custom;
  const hasValidMeta =
    meta &&
    typeof meta.totalStreamMs === "number" &&
    !Number.isNaN(meta.totalStreamMs) &&
    meta.totalStreamMs > 0;
  if (!hasValidMeta) return null;

  const formatMs = (ms: number) => {
    if (!ms || Number.isNaN(ms)) return "";
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };
  const modelShort = meta.model
    ? meta.model.split("/").pop() || meta.model
    : "";
  const fmtTok = (n: number) => {
    if (!n || Number.isNaN(n)) return "";
    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  };

  const durationText = formatMs(meta.totalStreamMs);
  if (!durationText) return null;

  return (
    <span className="inline-flex items-center gap-1 relative">
      <span className="text-[11px] text-norma-textDim font-mono">
        {durationText}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowInfo(!showInfo);
        }}
        className="win-btn !w-3.5 !h-3.5"
        title="详细信息"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {showInfo && (
        <div
          className="absolute left-0 bottom-full mb-1 rounded-lg bg-[#1a1a1f] border border-white/[0.08] shadow-xl px-3 py-2 z-50 text-[11px] font-mono space-y-1 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          {modelShort && (
            <div className="flex justify-between gap-3">
              <span className="text-norma-textDim">模型</span>
              <span className="text-norma-text">{modelShort}</span>
            </div>
          )}
          {meta.promptTokens > 0 && !Number.isNaN(meta.promptTokens) && (
            <div className="flex justify-between gap-3">
              <span className="text-norma-textDim">输入</span>
              <span className="text-norma-text">
                {fmtTok(meta.promptTokens)}
              </span>
            </div>
          )}
          {meta.completionTokens > 0 &&
            !Number.isNaN(meta.completionTokens) && (
              <div className="flex justify-between gap-3">
                <span className="text-norma-textDim">输出</span>
                <span className="text-norma-text">
                  {fmtTok(meta.completionTokens)}
                </span>
              </div>
            )}
          {meta.totalTokens > 0 && !Number.isNaN(meta.totalTokens) && (
            <div className="flex justify-between gap-3">
              <span className="text-norma-textDim">总计</span>
              <span className="text-norma-text">
                {fmtTok(meta.totalTokens)}
              </span>
            </div>
          )}
          {meta.firstTokenMs > 0 && !Number.isNaN(meta.firstTokenMs) && (
            <div className="flex justify-between gap-3">
              <span className="text-norma-textDim">首字延迟</span>
              <span className="text-norma-text">
                {formatMs(meta.firstTokenMs)}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-norma-textDim">总耗时</span>
            <span className="text-norma-text">{durationText}</span>
          </div>
        </div>
      )}
    </span>
  );
};

export const PlanBlock: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl bg-white/[0.03] border border-norma-accent/30 overflow-hidden my-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-norma-accent hover:bg-white/[0.02] transition-colors whitespace-nowrap"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="flex items-center gap-1.5 font-semibold">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          执行计划
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 text-[13px] text-norma-text/90 leading-relaxed whitespace-pre-wrap">
          {children}
        </div>
      )}
    </div>
  );
};

export const ReasoningBlock: React.FC<{
  text: string;
  isRunning?: boolean;
}> = ({ text, isRunning }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-norma-textMuted hover:text-norma-text transition-colors whitespace-nowrap"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="flex items-center gap-1.5">
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
          思考过程
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 text-[13px] text-norma-textMuted leading-relaxed whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
};

export const ReadScreenToolInline: React.FC<{
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  toolCallId: string;
  argsText: string;
  status?: { type: string };
}> = ({ toolName, args, result, status }) => {
  const isRunning = !result && status?.type !== "completed";
  const [open, setOpen] = useState(false);
  const res = result as any;
  const ocrResults = res?.success ? res.ocr_results || [] : [];
  const summary = res?.summary;
  const imageData = res?.image_base64;
  const label = getToolLabel(toolName);

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[13px] my-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] whitespace-nowrap hover:bg-white/[0.02] transition-colors"
      >
        <svg
          className={`w-3 h-3 text-norma-textDim transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <div
          className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : res ? (res.success ? "bg-emerald-400" : "bg-red-400") : "bg-norma-textDim"}`}
        />
        <span className="font-mono text-norma-textMuted">{label}</span>
        <span className="text-norma-textDim ml-auto text-[12px]">
          {isRunning
            ? "识别中..."
            : res
              ? res.success
                ? `${ocrResults.length} 文本`
                : "失败"
              : "等待中"}
        </span>
      </button>
      {open && isRunning && (
        <div className="px-3 py-2 text-norma-textDim">
          正在截取屏幕并识别...
        </div>
      )}
      {open && res && res.success && (
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
      {open && res && !res.success && (
        <div className="px-3 py-2 text-red-400/80">
          {res.error || res.message || "截图/OCR失败"}
        </div>
      )}
    </div>
  );
};

export const ListWindowsToolInline: React.FC<{
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  toolCallId: string;
  argsText: string;
  status?: { type: string };
}> = ({ toolName, args, result, status }) => {
  const isRunning = !result && status?.type !== "completed";
  const [open, setOpen] = useState(false);
  const res = result as any;
  const windows = res?.windows || [];
  const label = getToolLabel(toolName);

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[13px] my-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] whitespace-nowrap hover:bg-white/[0.02] transition-colors"
      >
        <svg
          className={`w-3 h-3 text-norma-textDim transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <div
          className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : res ? "bg-emerald-400" : "bg-norma-textDim"}`}
        />
        <span className="font-mono text-norma-textMuted">{label}</span>
        <span className="text-norma-textDim ml-auto text-[12px]">
          {isRunning ? "查询中..." : res ? `${windows.length} 窗口` : "等待中"}
        </span>
      </button>
      {open && isRunning && (
        <div className="px-3 py-2 text-norma-textDim">正在获取窗口列表...</div>
      )}
      {open && res && windows.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto scrollbar-show">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-norma-textDim text-[11px] uppercase tracking-wider">
                <th className="px-3 py-1 text-left font-medium">窗口</th>
                <th className="px-3 py-1 text-left font-medium">进程</th>
                <th className="px-3 py-1 text-right font-medium">尺寸</th>
                <th className="px-3 py-1 text-center font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {windows.map((w: any, i: number) => (
                <tr
                  key={i}
                  className={`border-t border-white/[0.03] hover:bg-white/[0.02] ${w.isActive ? "bg-norma-accent/[0.04]" : ""}`}
                >
                  <td className="px-3 py-1">
                    <div className="flex items-center gap-1.5">
                      {w.isActive && (
                        <span className="w-1 h-1 rounded-full bg-norma-accent flex-none" />
                      )}
                      <span className={`truncate max-w-[160px] ${w.isActive ? "text-norma-text font-medium" : "text-norma-textMuted"}`}>
                        {w.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1 text-norma-textDim font-mono text-[12px]">
                    {w.processName || (w.pid ? `PID:${w.pid}` : "")}
                  </td>
                  <td className="px-3 py-1 text-norma-textDim text-right whitespace-nowrap text-[12px]">
                    {w.bounds ? `${w.bounds.width}×${w.bounds.height}` : "—"}
                  </td>
                  <td className="px-3 py-1 text-center">
                    <span className={`text-[11px] px-1 py-0.5 rounded ${w.isActive ? "bg-norma-accent/20 text-norma-accent" : w.isMinimized ? "bg-white/[0.04] text-norma-textDim" : "bg-white/[0.04] text-norma-textDim"}`}>
                      {w.isActive ? "活跃" : w.isMinimized ? "最小化" : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ToolFallbackDisplay: React.FC<{
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  toolCallId: string;
  argsText: string;
  status?: { type: string };
  toolUI?: React.ReactNode;
  addResult?: (result: unknown) => void;
  resume?: (payload: unknown) => void;
}> = ({
  toolName,
  args,
  result,
  isError,
  toolCallId,
  argsText,
  status,
  toolUI,
}) => {
  const isRunning = !result && status?.type !== "completed";
  const isSubAgent =
    toolName === "systemAgent" ||
    toolName === "researchAgent" ||
    toolName === "system-agent" ||
    toolName === "research-agent";
  const displayName = isSubAgent
    ? toolName.includes("system")
      ? "System Agent"
      : "Research Agent"
    : toolName;

  const label = isSubAgent ? displayName : getToolLabel(toolName);
  const [open, setOpen] = useState(isSubAgent);

  const getStatusIcon = () => {
    if (isRunning) {
      return (
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-none" />
      );
    }
    if (result) {
      const isError = typeof result === "object" && (result as any)?.isError;
      return isError ? (
        <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-none" />
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-none" />
      );
    }
    return (
      <div className="w-1.5 h-1.5 rounded-full bg-norma-textDim flex-none" />
    );
  };

  const getStatusText = () => {
    if (isRunning) return "执行中...";
    if (result) {
      const isError = typeof result === "object" && (result as any)?.isError;
      return isError ? "失败" : "完成";
    }
    return "等待中";
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[13px] my-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] whitespace-nowrap hover:bg-white/[0.02] transition-colors"
      >
        <svg
          className={`w-3 h-3 text-norma-textDim transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {getStatusIcon()}
        <span
          className={`${isSubAgent ? "font-semibold text-norma-text" : "font-mono text-norma-textMuted"}`}
        >
          {isSubAgent ? `派发: ${displayName}` : label}
        </span>
        <span className="text-norma-textDim ml-auto text-[12px]">
          {getStatusText()}
        </span>
      </button>
      {open && result && (
        <div className="px-3 py-2 text-norma-text/80 leading-relaxed font-mono whitespace-pre-wrap text-[12px] bg-black/20 max-h-[200px] overflow-y-auto scrollbar-show">
          {typeof result === "string"
            ? result
            : (result as any)?.text || extractErrorMessage(result)}
        </div>
      )}
      {open && isRunning && (
        <div className="px-3 py-2 flex items-center gap-2 text-norma-textDim text-[12px] bg-black/10">
          <div className="flex gap-0.5">
            <span
              className="w-1 h-1 rounded-full bg-norma-accent animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-norma-accent animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-norma-accent animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span>正在执行 {label}...</span>
        </div>
      )}
      {open && !result && !isRunning && args && (
        <div className="px-3 py-2 text-norma-textDim leading-relaxed font-mono whitespace-pre-wrap text-[12px] bg-black/10">
          {JSON.stringify(args, null, 2)}
        </div>
      )}
    </div>
  );
};

export const FilePartView: React.FC = () => {
  const file = useMessagePartFile();
  return (
    <AttachmentPrimitive.Root className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 text-[12px]">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-norma-accent flex-none"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
      <div className="flex-1 min-w-0">
        <AttachmentPrimitive.Name className="text-norma-text truncate font-medium block" />
        {file.mimeType && (
          <div className="text-norma-textDim">{file.mimeType}</div>
        )}
      </div>
      <AttachmentPrimitive.Remove className="text-norma-textDim hover:text-red-400 transition-colors cursor-pointer flex-none">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
};

export const ImagePartView: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <AttachmentPrimitive.Root
      className={`rounded-lg overflow-hidden border border-white/[0.06] cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      <AttachmentPrimitive.unstable_Thumb className="overflow-hidden">
        <img
          alt="图片"
          className={`max-w-full transition-all duration-200 ${expanded ? "max-w-[300px]" : "max-w-[160px] max-h-[120px]"} object-cover`}
        />
      </AttachmentPrimitive.unstable_Thumb>
    </AttachmentPrimitive.Root>
  );
};
