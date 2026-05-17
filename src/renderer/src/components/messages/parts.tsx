import React, { useState } from "react";
import {
  useMessageTiming,
  useMessage,
  useMessagePartFile,
  useMessagePartImage,
} from "@assistant-ui/react";
import { getToolLabel } from "../../lib/tool-registry";

export const MessageTimingDisplay: React.FC = () => {
  const timing = useMessageTiming();
  const message = useMessage();
  const model = (message as any).metadata?.custom?.model;
  if (!timing?.totalStreamTime) return null;
  const formatMs = (ms: number) =>
    ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  return (
    <span className="text-[9px] text-norma-textDim font-mono">
      {model}
      {model && " · "}
      {formatMs(timing.totalStreamTime)}
      {timing.tokensPerSecond
        ? ` · ${Math.round(timing.tokensPerSecond)} tok/s`
        : ""}
      {timing.toolCallCount ? ` · ${timing.toolCallCount} 工具` : ""}
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

export const ToolFallbackDisplay: React.FC<any> = ({
  toolName,
  args,
  result,
  status,
}) => {
  const isRunning = status?.type === "running";
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
    <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 text-[10px]">
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
        <div className="text-norma-text truncate font-medium">
          {file.name || "附件文件"}
        </div>
        {file.mimeType && (
          <div className="text-norma-textDim">{file.mimeType}</div>
        )}
      </div>
    </div>
  );
};

export const ImagePartView: React.FC = () => {
  const image = useMessagePartImage();
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-lg overflow-hidden border border-white/[0.06] cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <img
        src={image.image}
        alt="图片"
        className={`max-w-full transition-all duration-200 ${expanded ? "max-w-[300px]" : "max-w-[160px] max-h-[120px]"} object-cover`}
      />
    </div>
  );
};
