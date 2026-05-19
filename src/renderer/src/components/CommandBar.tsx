import React, { useEffect } from "react";
import {
  useAuiState,
  MessagePrimitive,
  ComposerPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownComponents } from "../lib/markdown";
import { SlashCommandTrigger, MentionTrigger } from "./composer/SlashCommandTrigger";

const CommandBarMessage: React.FC = () => {
  const role = useAuiState((s: any) => s.message.role);
  if (role === "user") {
    return (
      <MessagePrimitive.Root className="flex justify-end mb-2">
        <div className="max-w-[85%] rounded-lg bg-white/[0.08] px-3 py-1.5">
          <MessagePrimitive.Content
            components={{
              Text: ({ text }: any) => (
                <span className="whitespace-pre-wrap text-[12px] text-norma-text leading-relaxed">
                  {text}
                </span>
              ),
            }}
          />
        </div>
      </MessagePrimitive.Root>
    );
  }
  return (
    <MessagePrimitive.Root className="flex justify-start mb-2">
      <div className="max-w-[90%]">
        <MessagePrimitive.Content
          components={{
            Text: (props: any) => (
              <div className="text-[12px] leading-relaxed text-norma-text">
                <MarkdownTextPrimitive
                  {...props}
                  components={MarkdownComponents}
                  remarkPlugins={[remarkGfm]}
                />
              </div>
            ),
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
};

const CommandBarInner: React.FC = () => {
  const isRunning = useAuiState((s: any) => s.thread.isRunning);
  const messageCount = useAuiState((s: any) => s.thread.messages?.length ?? 0);

  useEffect(() => {
    if (isRunning && messageCount > 0) {
      window.electronAPI?.resizeWindow?.(680, 360);
    }
  }, [isRunning, messageCount]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-none flex items-center gap-3 h-[52px] px-4 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-full bg-norma-accentMuted flex items-center justify-center flex-none">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(215, 90%, 68%)"
            strokeWidth="3"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
          </svg>
        </div>
        <ComposerPrimitive.Root className="flex-1 min-w-0 h-full flex items-center">
          <ComposerPrimitive.Unstable_TriggerPopoverRoot>
            <SlashCommandTrigger />
            <MentionTrigger />
            <ComposerPrimitive.Input
              placeholder="输入指令，Enter 发送..."
              rows={1}
              autoFocus
              className="flex-1 w-full bg-transparent text-[15px] text-norma-text placeholder-norma-textMuted outline-none resize-none leading-none py-0"
              onKeyDown={(e: any) => {
                if (e.key === "Escape") {
                  window.electronAPI?.hideWindow?.();
                }
              }}
            />
          </ComposerPrimitive.Unstable_TriggerPopoverRoot>
        </ComposerPrimitive.Root>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-show px-4 py-3 min-h-0 scroll-smooth">
        <ThreadPrimitive.Messages>
          {() => <CommandBarMessage />}
        </ThreadPrimitive.Messages>
      </div>
    </div>
  );
};

export { CommandBarInner };
