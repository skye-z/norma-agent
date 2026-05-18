import React, { useState, useEffect } from "react";
import {
  MessagePrimitive,
  BranchPickerPrimitive,
  ActionBarPrimitive,
  useMessage,
  useMessageTiming,
  SelectionToolbarPrimitive,
  useThreadRuntime,
  useThread,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownComponents } from "../../lib/markdown";
import { lastMetadata } from "../../lib/ipc-chat";
import {
  ReasoningBlock,
  ToolFallbackDisplay,
  FilePartView,
  ImagePartView,
  extractErrorMessage,
} from "./parts";

const MessageTimingBadge: React.FC = () => {
  const timing = useMessageTiming();
  if (
    !timing ||
    Number.isNaN(timing.totalStreamTime) ||
    !timing.totalStreamTime
  )
    return null;
  const formatMs = (ms: number) => {
    if (!ms || Number.isNaN(ms)) return "";
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };
  const main = formatMs(timing.totalStreamTime);
  if (!main) return null;
  return (
    <span className="text-[9px] text-norma-textDim font-mono">
      {main}
      {timing.firstTokenTime && !Number.isNaN(timing.firstTokenTime)
        ? ` · TTFT ${formatMs(timing.firstTokenTime)}`
        : ""}
      {timing.tokensPerSecond && !Number.isNaN(timing.tokensPerSecond)
        ? ` · ${Math.round(timing.tokensPerSecond)} tok/s`
        : ""}
    </span>
  );
};

const FeedbackButtons: React.FC = () => {
  const [voted, setVoted] = useState<"positive" | "negative" | null>(null);
  const runtime = useThreadRuntime();
  const handleFeedback = (type: "positive" | "negative") => {
    setVoted(type);
    try {
      (runtime as any).submitFeedback?.(type);
    } catch {}
  };
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        onClick={() => handleFeedback("positive")}
        className={`win-btn !w-4 !h-4 ${voted === "positive" ? "text-emerald-400" : ""}`}
        title="有帮助"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        onClick={() => handleFeedback("negative")}
        className={`win-btn !w-4 !h-4 ${voted === "negative" ? "text-red-400" : ""}`}
        title="没帮助"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </span>
  );
};

const LoadingIndicator: React.FC = () => {
  const thread = useThread();
  const message = useMessage();
  const hasText = (message as any).content?.some(
    (p: any) => p.type === "text" && p.text?.length > 0,
  );
  const isRunning = thread.isRunning;
  if (!isRunning || hasText) return null;
  return (
    <div className="flex items-center gap-1.5 py-1">
      <div
        className="w-1 h-1 rounded-full bg-norma-accent animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <div
        className="w-1 h-1 rounded-full bg-norma-accent animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <div
        className="w-1 h-1 rounded-full bg-norma-accent animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
      <span className="text-[10px] text-norma-textDim">思考中...</span>
    </div>
  );
};

const ModelNameBadge: React.FC = () => {
  const [meta, setMeta] = useState(lastMetadata);
  useEffect(() => {
    const id = setInterval(() => {
      if (lastMetadata !== meta) setMeta(lastMetadata);
    }, 300);
    return () => clearInterval(id);
  }, [meta]);
  const displayName = meta?.displayName || "";
  const fmtTok = (n: number) => {
    if (!n || Number.isNaN(n)) return "";
    return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  };
  const formatMs = (ms: number) => {
    if (!ms || Number.isNaN(ms)) return "";
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };
  if (!displayName && !meta?.totalTokens) return null;
  return (
    <span className="text-[9px] text-norma-textDim font-mono">
      {meta?.totalStreamMs > 0 && (
        <span className="mr-1.5">{formatMs(meta.totalStreamMs)}</span>
      )}
      {displayName && <span>{displayName}</span>}
      {meta?.totalTokens > 0 && (
        <>
          <span className="mx-1 text-white/[0.15]">|</span>
          <span>↑{fmtTok(meta.promptTokens)}</span>
          <span className="mx-0.5">↓{fmtTok(meta.completionTokens)}</span>
        </>
      )}
    </span>
  );
};

const SpeechButton: React.FC = () => {
  const [speaking, setSpeaking] = useState(false);
  const message = useMessage();
  const handleSpeak = () => {
    const text =
      (message as any).content
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join(" ") || "";
    if (!text || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 2000));
    utterance.lang = "zh-CN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  return (
    <button
      onClick={handleSpeak}
      className={`win-btn !w-4 !h-4 ${speaking ? "text-norma-accent" : ""}`}
      title={speaking ? "停止朗读" : "朗读"}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {speaking ? (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </>
        )}
      </svg>
    </button>
  );
};

const ErrorDisplay: React.FC = () => {
  const message = useMessage();
  const err = (message as any)?.error;
  const text = extractErrorMessage(err);
  return (
    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
      {text}
    </div>
  );
};

export const AssistantMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-start group mb-6">
      <div className="max-w-[80%] relative">
        <SelectionToolbarPrimitive.Root className="absolute z-50 -top-10 left-1/2 -translate-x-1/2 glass-popover px-1.5 py-1 flex gap-0.5 shadow-xl">
          <SelectionToolbarPrimitive.Quote className="win-btn !w-6 !h-5 text-[9px] text-norma-textMuted hover:text-norma-text">
            引用
          </SelectionToolbarPrimitive.Quote>
        </SelectionToolbarPrimitive.Root>

        <div className="bubble bubble-assistant">
          <div className="flex flex-col gap-[5px] w-full min-w-0">
            <LoadingIndicator />
            <MessagePrimitive.Content
              components={{
                Text: ({ text }) => (
                  <div className="text-[12px] leading-relaxed break-words overflow-wrap-anywhere">
                    <MarkdownTextPrimitive
                      components={MarkdownComponents}
                      remarkPlugins={[remarkGfm]}
                    />
                  </div>
                ),
                Reasoning: ({ text }) => <ReasoningBlock text={text} />,
                tools: {
                  Fallback: ToolFallbackDisplay,
                },
                Source: ({ url, title }) => (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-norma-accent hover:underline mt-1"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    {title || url}
                  </a>
                ),
                File: () => <FilePartView />,
                Image: () => <ImagePartView />,
              }}
            />
          </div>
          <MessagePrimitive.Error>
            <ErrorDisplay />
          </MessagePrimitive.Error>
        </div>
        <div className="flex items-center gap-1 absolute -bottom-5 left-0 right-0 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
          <ModelNameBadge />
          <MessageTimingBadge />
          <div className="flex-1" />
          <FeedbackButtons />
          <SpeechButton />
          <BranchPickerPrimitive.Root
            hideWhenSingleBranch
            className="inline-flex items-center gap-0.5 text-norma-textDim text-[10px]"
          >
            <BranchPickerPrimitive.Previous className="win-btn !w-4 !h-4">
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </BranchPickerPrimitive.Previous>
            <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
            <BranchPickerPrimitive.Next className="win-btn !w-4 !h-4">
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </BranchPickerPrimitive.Next>
          </BranchPickerPrimitive.Root>
          <ActionBarPrimitive.Root
            hideWhenRunning
            autohide="not-last"
            className="flex gap-0.5"
          >
            <ActionBarPrimitive.Copy className="win-btn !w-4 !h-4" title="复制">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload
              className="win-btn !w-4 !h-4"
              title="重新生成"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};
