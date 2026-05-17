import React, { useState } from "react";
import {
  MessagePrimitive,
  BranchPickerPrimitive,
  ActionBarPrimitive,
  ErrorPrimitive,
  useMessage,
  useMessageTiming,
  ChainOfThoughtPrimitive,
  SelectionToolbarPrimitive,
  useThreadRuntime,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownComponents } from "../../lib/markdown";
import {
  ReasoningBlock,
  ToolFallbackDisplay,
  FilePartView,
  ImagePartView,
  MessageMetaDisplay,
} from "./parts";

const MessageTimingBadge: React.FC = () => {
  const timing = useMessageTiming();
  if (!timing?.totalStreamTime) return null;
  const formatMs = (ms: number) => ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  return (
    <span className="text-[9px] text-norma-textDim font-mono">
      {formatMs(timing.totalStreamTime)}
      {timing.firstTokenTime ? ` · TTFT ${formatMs(timing.firstTokenTime)}` : ""}
      {timing.tokensPerSecond ? ` · ${Math.round(timing.tokensPerSecond)} tok/s` : ""}
    </span>
  );
};

const FeedbackButtons: React.FC = () => {
  const [voted, setVoted] = useState<"positive" | "negative" | null>(null);
  const runtime = useThreadRuntime();
  const handleFeedback = (type: "positive" | "negative") => {
    setVoted(type);
    try { (runtime as any).submitFeedback?.(type); } catch {}
  };
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        onClick={() => handleFeedback("positive")}
        className={`win-btn !w-4 !h-4 ${voted === "positive" ? "text-emerald-400" : ""}`}
        title="有帮助"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
      </button>
      <button
        onClick={() => handleFeedback("negative")}
        className={`win-btn !w-4 !h-4 ${voted === "negative" ? "text-red-400" : ""}`}
        title="没帮助"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
      </button>
    </span>
  );
};

const SpeechButton: React.FC = () => {
  const [speaking, setSpeaking] = useState(false);
  const message = useMessage();
  const handleSpeak = () => {
    const text = (message as any).content
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
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {speaking
          ? <><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
          : <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
        }
      </svg>
    </button>
  );
};

export const AssistantMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-start group">
      <div className="max-w-[80%] relative">
        <SelectionToolbarPrimitive.Root className="absolute z-50 -top-10 left-1/2 -translate-x-1/2 glass-popover px-1.5 py-1 flex gap-0.5 shadow-xl">
          <SelectionToolbarPrimitive.Quote className="win-btn !w-6 !h-5 text-[9px] text-norma-textMuted hover:text-norma-text">
            引用
          </SelectionToolbarPrimitive.Quote>
        </SelectionToolbarPrimitive.Root>

        <div className="bubble bubble-assistant">
          <div className="flex flex-col gap-[5px] w-full min-w-0">
            <ChainOfThoughtPrimitive.Root className="flex flex-col gap-[5px]">
              <ChainOfThoughtPrimitive.AccordionTrigger className="hidden" />
              <ChainOfThoughtPrimitive.Parts
                components={{
                  Reasoning: ({ text }) => <ReasoningBlock text={text} />,
                  tools: { Fallback: ToolFallbackDisplay },
                }}
              />
            </ChainOfThoughtPrimitive.Root>

            <MessagePrimitive.Content
              components={{
                Text: ({ text }) => (
                  <div className="text-[12px] leading-relaxed">
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
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-norma-accent hover:underline mt-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    {title || url}
                  </a>
                ),
                File: () => <FilePartView />,
                Image: () => <ImagePartView />,
              }}
            />
          </div>
          <MessagePrimitive.Error>
            <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
              <ErrorPrimitive.Message />
            </div>
          </MessagePrimitive.Error>
        </div>
        <div className="flex items-center gap-1 absolute -bottom-5 left-0 right-0 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
          <MessageTimingBadge />
          <MessageMetaDisplay />
          <div className="flex-1" />
          <FeedbackButtons />
          <SpeechButton />
          <BranchPickerPrimitive.Root hideWhenSingleBranch className="inline-flex items-center gap-0.5 text-norma-textDim text-[10px]">
            <BranchPickerPrimitive.Previous className="win-btn !w-4 !h-4">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
            </BranchPickerPrimitive.Previous>
            <BranchPickerPrimitive.Number />/<BranchPickerPrimitive.Count />
            <BranchPickerPrimitive.Next className="win-btn !w-4 !h-4">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
            </BranchPickerPrimitive.Next>
          </BranchPickerPrimitive.Root>
          <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="flex gap-0.5">
            <ActionBarPrimitive.Copy className="win-btn !w-4 !h-4" title="复制" />
            <ActionBarPrimitive.Reload className="win-btn !w-4 !h-4" title="重新生成" />
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};
