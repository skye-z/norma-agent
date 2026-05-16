import React, { useState } from "react";
import {
  MessagePrimitive,
  BranchPickerPrimitive,
  ActionBarPrimitive,
  ErrorPrimitive,
  useMessage,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownComponents } from "../../lib/markdown";
import {
  ReasoningBlock,
  ToolFallbackDisplay,
  FilePartView,
  ImagePartView,
  MessageTimingDisplay,
} from "./parts";

export const AssistantMessage: React.FC = () => {
  const message = useMessage();
  const toolCallCount = message.content.filter(
    (p: any) => p.type === "tool-call",
  ).length;
  const [toolsCollapsed, setToolsCollapsed] = useState(false);

  return (
    <MessagePrimitive.Root className="flex justify-start group">
      <div className="max-w-[80%] relative">
        <div className="bubble bubble-assistant">
          {toolCallCount > 1 && (
            <button
              onClick={() => setToolsCollapsed(!toolsCollapsed)}
              className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg bg-white/[0.02] border border-white/[0.05] text-[10px] text-norma-textMuted hover:text-norma-text transition-colors whitespace-nowrap"
            >
              <svg
                className={`w-3 h-3 transition-transform ${toolsCollapsed ? "" : "rotate-90"}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span>{toolCallCount} 个工具调用</span>
              <span className="ml-auto text-norma-textDim">
                {toolsCollapsed ? "展开" : "折叠"}
              </span>
            </button>
          )}
          <div className="flex flex-col gap-[5px] w-full min-w-0">
            <MessagePrimitive.Content
              components={{
                Text: (props: any) => (
                  <div className="text-[12px] leading-relaxed">
                    <MarkdownTextPrimitive
                      {...props}
                      components={MarkdownComponents}
                      remarkPlugins={[remarkGfm]}
                    />
                  </div>
                ),
                Reasoning: ({ text }) => <ReasoningBlock text={text} />,
                ToolCall: ({ ...props }) => {
                  if (toolsCollapsed) return null;
                  if (props.toolUI) return props.toolUI;
                  return <ToolFallbackDisplay {...props} />;
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
            <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
              <ErrorPrimitive.Message />
            </div>
          </MessagePrimitive.Error>
        </div>
        <div className="flex items-center gap-1 absolute -bottom-5 left-0 right-0 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
          <MessageTimingDisplay />
          <div className="flex-1" />
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
            <ActionBarPrimitive.Copy
              className="win-btn !w-4 !h-4"
              title="复制"
            />
            <ActionBarPrimitive.Reload
              className="win-btn !w-4 !h-4"
              title="重新生成"
            />
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};
