import React, { useState } from "react";
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
  if (!meta) return null;

  const formatMs = (ms: number) =>
    ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  const modelShort = meta.model ? meta.model.split('/').pop() || meta.model : '';
  const fmtTok = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <span className="inline-flex items-center gap-1 relative">
      <span className="text-[9px] text-norma-textDim font-mono">
        {formatMs(meta.totalStreamMs)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
        className="win-btn !w-3.5 !h-3.5"
        title="详细信息"
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {showInfo && (
        <div className="absolute left-0 bottom-full mb-1 rounded-lg bg-[#1a1a1f] border border-white/[0.08] shadow-xl px-3 py-2 z-50 text-[9px] font-mono space-y-1 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
          {modelShort && <div className="flex justify-between gap-3"><span className="text-norma-textDim">模型</span><span className="text-norma-text">{modelShort}</span></div>}
          {meta.promptTokens > 0 && <div className="flex justify-between gap-3"><span className="text-norma-textDim">输入</span><span className="text-norma-text">{fmtTok(meta.promptTokens)}</span></div>}
          {meta.completionTokens > 0 && <div className="flex justify-between gap-3"><span className="text-norma-textDim">输出</span><span className="text-norma-text">{fmtTok(meta.completionTokens)}</span></div>}
          {meta.totalTokens > 0 && <div className="flex justify-between gap-3"><span className="text-norma-textDim">总计</span><span className="text-norma-text">{fmtTok(meta.totalTokens)}</span></div>}
          {meta.firstTokenMs > 0 && <div className="flex justify-between gap-3"><span className="text-norma-textDim">首字延迟</span><span className="text-norma-text">{formatMs(meta.firstTokenMs)}</span></div>}
          <div className="flex justify-between gap-3"><span className="text-norma-textDim">总耗时</span><span className="text-norma-text">{formatMs(meta.totalStreamMs)}</span></div>
        </div>
      )}
    </span>
  );
};

export const PlanBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl bg-white/[0.03] border border-norma-accent/30 overflow-hidden my-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-norma-accent hover:bg-white/[0.02] transition-colors whitespace-nowrap"
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          执行计划
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 text-[11px] text-norma-text/90 leading-relaxed whitespace-pre-wrap">
          {children}
        </div>
      )}
    </div>
  );
};

export const ReasoningBlock: React.FC<{ text: string; isRunning?: boolean }> = ({
  text,
  isRunning,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-norma-textMuted hover:text-norma-text transition-colors whitespace-nowrap"
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
        <div className="px-3 pb-2.5 text-[11px] text-norma-textMuted leading-relaxed whitespace-pre-wrap">
          {text}
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
  const isSubAgent = toolName === "systemAgent" || toolName === "researchAgent" || toolName === "system-agent" || toolName === "research-agent";
  const displayName = isSubAgent ? (toolName.includes("system") ? "System Agent" : "Research Agent") : toolName;

  const label = isSubAgent ? displayName : getToolLabel(toolName);
  const [open, setOpen] = useState(isSubAgent);

  const getStatusIcon = () => {
    if (isRunning) {
      return (
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-none" />
      );
    }
    if (result) {
      const isError = typeof result === 'object' && (result as any)?.isError;
      return isError
        ? <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-none" />
        : <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-none" />;
    }
    return <div className="w-1.5 h-1.5 rounded-full bg-norma-textDim flex-none" />;
  };

  const getStatusText = () => {
    if (isRunning) return "执行中...";
    if (result) {
      const isError = typeof result === 'object' && (result as any)?.isError;
      return isError ? "失败" : "完成";
    }
    return "等待中";
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[11px] my-1">
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
        <span className={`${isSubAgent ? "font-semibold text-norma-text" : "font-mono text-norma-textMuted"}`}>
          {isSubAgent ? `派发: ${displayName}` : label}
        </span>
        <span className="text-norma-textDim ml-auto text-[10px]">
          {getStatusText()}
        </span>
      </button>
      {open && result && (
        <div className="px-3 py-2 text-norma-text/80 leading-relaxed font-mono whitespace-pre-wrap text-[10px] bg-black/20 max-h-[200px] overflow-y-auto">
          {typeof result === "string"
            ? result
            : (result as any)?.text || JSON.stringify(result, null, 2)}
        </div>
      )}
      {open && isRunning && (
        <div className="px-3 py-2 flex items-center gap-2 text-norma-textDim text-[10px] bg-black/10">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-norma-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-norma-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-norma-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>正在执行 {label}...</span>
        </div>
      )}
      {open && !result && !isRunning && args && (
        <div className="px-3 py-2 text-norma-textDim leading-relaxed font-mono whitespace-pre-wrap text-[10px] bg-black/10">
          {JSON.stringify(args, null, 2)}
        </div>
      )}
    </div>
  );
};

export const FilePartView: React.FC = () => {
  const file = useMessagePartFile();
  return (
    <AttachmentPrimitive.Root className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 text-[10px]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-norma-accent flex-none">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
      <div className="flex-1 min-w-0">
        <AttachmentPrimitive.Name className="text-norma-text truncate font-medium block" />
        {file.mimeType && <div className="text-norma-textDim">{file.mimeType}</div>}
      </div>
      <AttachmentPrimitive.Remove className="text-norma-textDim hover:text-red-400 transition-colors cursor-pointer flex-none">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
