import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  useLocalRuntime,
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  MessagePrimitive,
  AuiIf,
  useAuiState,
  useAui,
  Suggestions,
  useMessageTiming,
  makeAssistantToolUI,
  useMessage,
  useThreadModelContext,
  useMessagePartFile,
  useMessagePartImage,
  useThreadViewportAutoScroll,
  WebSpeechDictationAdapter,
  unstable_useSlashCommandAdapter,
  unstable_useMentionAdapter,
  ErrorPrimitive,
  SuggestionPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { LeftIsland } from "./components/LeftIsland";
import { WindowControls } from "./components/WindowControls";
import "./index.css";

declare global {
  interface Window {
    electronAPI: {
      sendMessage: (channel: string, data: any) => void;
      onMessage: (channel: string, callback: (data: any) => void) => () => void;
      hideWindow: () => void;
      minimizeWindow: () => void;
      quitApp: () => void;
      platform: string;
    };
  }
}

const MOCK_CHAT_MODEL = {
  async *run({ messages, abortSignal }) {
    const last = messages[messages.length - 1];
    const text =
      typeof last.content === "string"
        ? last.content
        : last.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("");

    yield {
      content: [
        {
          type: "reasoning",
          text:
            "用户在询问：" +
            text.slice(0, 50) +
            "...\n让我分析一下最佳的回答方式。",
        },
      ],
    };

    await new Promise((r) => setTimeout(r, 600));

    yield {
      content: [
        {
          type: "reasoning",
          text:
            "用户在询问：" +
            text.slice(0, 50) +
            "...\n让我分析一下最佳的回答方式。\n我需要先查看屏幕上的内容来给出更精准的回复。",
        },
        {
          type: "tool-call",
          toolCallId: "tc_1",
          toolName: "read_screen",
          args: { capture: true },
          argsText: '{"capture":true}',
        },
      ],
    };

    await new Promise((r) => setTimeout(r, 800));

    yield {
      content: [
        {
          type: "reasoning",
          text:
            "用户在询问：" +
            text.slice(0, 50) +
            "...\n让我分析一下最佳的回答方式。\n我需要先查看屏幕上的内容来给出更精准的回复。",
        },
        {
          type: "tool-call",
          toolCallId: "tc_1",
          toolName: "read_screen",
          args: { capture: true },
          argsText: '{"capture":true}',
          result: {
            success: true,
            description: "检测到：VS Code 编辑器，3个打开的标签页",
          },
        },
        {
          type: "text",
          text: "\n\n我已经查看了你的屏幕。你当前打开了 VS Code 编辑器，有 3 个标签页。需要我帮你做什么具体的操作吗？",
        },
        {
          type: "source",
          sourceType: "url",
          id: "s1",
          url: "https://docs.norma.dev/screen-api",
          title: "屏幕读取 API 文档",
        },
      ],
    };
  },
};

const INITIAL_MESSAGES = [
  {
    role: "assistant" as const,
    content: [
      {
        type: "text" as const,
        text: "你好，我是 Norma —— 你的本地智能助手。\n\n我可以读取屏幕、操控鼠标键盘、管理你的工作流。有什么需要帮忙的吗？",
      },
    ],
    metadata: {
      timing: {
        streamStartTime: Date.now() - 2000,
        firstTokenTime: 120,
        totalStreamTime: 850,
        tokenCount: 42,
        tokensPerSecond: 49.4,
        totalChunks: 8,
        toolCallCount: 0,
      },
      custom: { model: "Norma Local" },
    },
  },
  {
    role: "user" as const,
    content: "帮我看看屏幕上有什么内容",
  },
  {
    role: "assistant" as const,
    content: [
      {
        type: "reasoning" as const,
        text: "用户想了解屏幕内容，我需要调用屏幕截图工具来获取当前画面，然后分析其中的文字和 UI 元素。",
      },
      {
        type: "tool-call" as const,
        toolCallId: "tc_init_1",
        toolName: "read_screen",
        args: { capture: true, region: "full" },
        argsText: '{"capture":true,"region":"full"}',
        result: {
          success: true,
          description:
            "检测到 2 个应用程序窗口：Chrome（5个标签）和 VS Code（已最小化）",
        },
      },
      {
        type: "text" as const,
        text: "\n\n我已经扫描了你的屏幕，发现以下内容：\n\n- **Chrome 浏览器**：打开了 5 个标签页\n- **VS Code**：在后台已最小化\n\n目前 Chrome 是你的活跃窗口。需要我对某个标签页进行操作吗？",
      },
      {
        type: "source" as const,
        sourceType: "url" as const,
        id: "s_init_1",
        url: "https://docs.norma.dev/capabilities/screen",
        title: "屏幕感知能力文档",
      },
    ],
    metadata: {
      timing: {
        streamStartTime: Date.now() - 5000,
        firstTokenTime: 200,
        totalStreamTime: 1200,
        tokenCount: 78,
        tokensPerSecond: 65.0,
        totalChunks: 12,
        toolCallCount: 1,
      },
      custom: { model: "Norma Local" },
    },
  },
  {
    role: "user" as const,
    content: [
      {
        type: "text" as const,
        text: "帮我把 VS Code 打开并切换到 main.ts 文件",
      },
      {
        type: "file" as const,
        mimeType: "text/typescript",
        data: "aW1wb3J0IHsgYXBwIH0gZnJvbSAnZWxlY3Ryb24n",
      },
    ],
  },
  {
    role: "assistant" as const,
    content: [
      {
        type: "reasoning" as const,
        text: "用户想要切换到 VS Code 并打开特定文件。我看到用户还附了一个 TypeScript 文件。我需要：\n1. 激活 VS Code 窗口\n2. 使用快捷键打开文件搜索\n3. 搜索并打开 main.ts",
      },
      {
        type: "tool-call" as const,
        toolCallId: "tc_init_2",
        toolName: "execute_action",
        args: { action: "activate_window", app: "VS Code" },
        argsText: '{"action":"activate_window","app":"VS Code"}',
        result: { success: true, description: "VS Code 已激活" },
      },
      {
        type: "tool-call" as const,
        toolCallId: "tc_init_3",
        toolName: "execute_action",
        args: { action: "open_file", filename: "main.ts" },
        argsText: '{"action":"open_file","filename":"main.ts"}',
        result: { success: true, description: "已打开 src/main/index.ts" },
      },
      {
        type: "text" as const,
        text: "\n\n搞定了！我已经：\n\n1. 激活了 VS Code 窗口\n2. 打开了 `src/main/index.ts` 文件\n\n你现在已经可以看到该文件的内容了。需要我对文件做什么修改吗？",
      },
      {
        type: "source" as const,
        sourceType: "url" as const,
        id: "s_init_2",
        url: "https://docs.norma.dev/capabilities/control",
        title: "系统操控能力文档",
      },
      {
        type: "source" as const,
        sourceType: "url" as const,
        id: "s_init_3",
        url: "https://docs.norma.dev/shortcuts",
        title: "快捷键参考",
      },
    ],
    metadata: {
      timing: {
        streamStartTime: Date.now() - 8000,
        firstTokenTime: 150,
        totalStreamTime: 2100,
        tokenCount: 95,
        tokensPerSecond: 45.2,
        totalChunks: 15,
        toolCallCount: 2,
      },
      custom: { model: "Norma Local" },
    },
  },
];

const SLASH_COMMANDS = [
  { command: "/screen", description: "读取当前屏幕内容" },
  { command: "/action", description: "执行系统操作" },
  { command: "/file", description: "文件管理操作" },
  { command: "/search", description: "搜索知识库" },
  { command: "/code", description: "代码生成与分析" },
  { command: "/help", description: "查看帮助信息" },
];

const MODELS = [
  { id: "norma-local", name: "Norma Local", desc: "本地模型" },
  { id: "gpt-4o", name: "GPT-4o", desc: "OpenAI" },
  { id: "claude-3.5", name: "Claude 3.5", desc: "Anthropic" },
];

function NormaRuntime({ children }: { children: React.ReactNode }) {
  const runtime = useLocalRuntime(MOCK_CHAT_MODEL, {
    initialMessages: INITIAL_MESSAGES,
    maxSteps: 5,
    adapters: {
      dictation: new WebSpeechDictationAdapter(),
    },
  });
  const aui = useAui({
    suggestions: Suggestions([
      {
        title: "分析屏幕",
        label: "读取当前屏幕内容",
        prompt: "帮我分析当前屏幕上的内容",
      },
      {
        title: "整理文件",
        label: "自动分类下载目录",
        prompt: "帮我把下载目录里的文件按类型整理",
      },
      {
        title: "写代码",
        label: "根据描述生成代码",
        prompt: "帮我写一个 React 组件",
      },
      {
        title: "查文档",
        label: "搜索技术文档",
        prompt: "帮我查一下 Electron 的 IPC 通信方式",
      },
    ]),
  });
  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

const ReadScreenTool = makeAssistantToolUI({
  toolName: "read_screen",
  component: ({ args, result, status }) => {
    const isRunning = status.type === "running";
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : result ? "bg-emerald-400" : "bg-norma-textDim"}`}
          />
          <span className="font-mono text-norma-textMuted">read_screen</span>
          <span className="text-norma-textDim ml-auto">
            {isRunning ? "读取中..." : result ? "完成" : "等待中"}
          </span>
        </div>
        {result && (
          <div className="px-3 py-2 text-norma-text/80 leading-relaxed">
            {result.description}
          </div>
        )}
      </div>
    );
  },
});

const ExecuteActionTool = makeAssistantToolUI({
  toolName: "execute_action",
  component: ({ args, result, status }) => {
    const isRunning = status.type === "running";
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[11px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : result ? "bg-emerald-400" : "bg-norma-textDim"}`}
          />
          <span className="font-mono text-norma-textMuted">
            {args?.action || "execute_action"}
          </span>
          <span className="text-norma-textDim ml-auto">
            {isRunning ? "执行中..." : result ? "完成" : "等待中"}
          </span>
        </div>
        {result && (
          <div className="px-3 py-2 text-norma-text/80 leading-relaxed">
            {result.description}
          </div>
        )}
      </div>
    );
  },
});

const MessageTimingDisplay: React.FC = () => {
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

const ReasoningBlock: React.FC<{ text: string; isRunning?: boolean }> = ({
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

const ToolFallbackDisplay: React.FC<any> = ({
  toolName,
  args,
  result,
  status,
}) => {
  const isRunning = status?.type === "running";
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden text-[11px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] whitespace-nowrap">
        <div
          className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-amber-400 animate-pulse" : result ? "bg-emerald-400" : "bg-norma-textDim"}`}
        />
        <span className="font-mono text-norma-textMuted">{toolName}</span>
        <span className="text-norma-textDim ml-auto">
          {isRunning ? "运行中..." : result ? "完成" : "等待中"}
        </span>
      </div>
      {result && (
        <div className="px-3 py-2 text-norma-text/80 leading-relaxed">
          {typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2)}
        </div>
      )}
    </div>
  );
};

const FilePartView: React.FC = () => {
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

const ImagePartView: React.FC = () => {
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

const ContextDisplay: React.FC = () => {
  const ctx = useThreadModelContext();
  if (!ctx) return null;
  const text = typeof ctx === "string" ? ctx : ((ctx as any).system ?? "");
  if (!text) return null;
  return (
    <div
      className="px-3 py-1 text-[9px] text-norma-textDim font-mono truncate border-b border-white/[0.04]"
      title={text}
    >
      上下文: {text.slice(0, 80)}
      {text.length > 80 ? "..." : ""}
    </div>
  );
};

const AGENTS = [
  { id: "norma", type: "agent", label: "Norma", description: "通用助手" },
  { id: "coder", type: "agent", label: "Coder", description: "代码专家" },
  { id: "screen", type: "agent", label: "Screen", description: "屏幕感知" },
];

const SlashCommandTrigger: React.FC = () => {
  const slash = unstable_useMentionAdapter({
    items: SLASH_COMMANDS.map((cmd) => ({
      id: cmd.command,
      label: cmd.command,
      description: cmd.description,
      type: "command",
    })),
    formatter: {
      serialize: (item) => `${item.label} `,
      parse: (text) => [{ kind: "text", text }],
    },
  });

  return (
    <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Directive
        formatter={slash.directive.formatter}
      />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) => (
          <div className="glass-popover absolute bottom-full mb-2 left-0 w-64 flex flex-col py-1 z-50">
            {items.map((item, i) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={item.id}
                item={item}
                index={i}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-norma-textMuted hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-norma-text transition-colors text-left"
              >
                <span className="font-mono text-norma-accent">
                  {item.label}
                </span>
                <span className="flex-1 text-norma-textDim">
                  {item.description}
                </span>
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))}
          </div>
        )}
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
};

const MentionTrigger: React.FC = () => {
  const mention = unstable_useMentionAdapter({
    items: AGENTS,
    formatter: {
      serialize: (item) => `@${item.label} `,
      parse: (text) => [{ kind: "text", text }],
    },
  });

  return (
    <ComposerPrimitive.Unstable_TriggerPopover
      char="@"
      adapter={mention.adapter}
    >
      <ComposerPrimitive.Unstable_TriggerPopover.Directive
        formatter={mention.directive.formatter}
      />
      <ComposerPrimitive.Unstable_TriggerPopoverItems>
        {(items) => (
          <div className="glass-popover absolute bottom-full mb-2 left-0 w-64 flex flex-col py-1 z-50">
            {items.map((item, i) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={item.id}
                item={item}
                index={i}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-norma-textMuted hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-norma-text transition-colors text-left"
              >
                <span className="w-4 h-4 rounded-full bg-norma-accentMuted flex items-center justify-center text-[8px] text-norma-accent font-bold">
                  {(item.label as string)[0]}
                </span>
                <span className="font-medium text-norma-text">
                  {item.label}
                </span>
                <span className="flex-1 text-norma-textDim">
                  {item.description}
                </span>
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))}
          </div>
        )}
      </ComposerPrimitive.Unstable_TriggerPopoverItems>
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
};

const VoiceButton: React.FC = () => {
  return (
    <ComposerPrimitive.Dictate
      className="flex-none p-1.5 rounded-full text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06] transition-colors"
      title="语音输入"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </ComposerPrimitive.Dictate>
  );
};

const ModelSelector: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(MODELS[0]);
  return (
    <div className="relative flex-none">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06] transition-colors"
        title="选择模型"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>{selected.name}</span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="glass-popover absolute bottom-full left-0 mb-2 w-44 overflow-hidden">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                setSelected(model);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.08] transition-colors ${selected.id === model.id ? "text-norma-accent" : "text-norma-textMuted"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <div className="flex-1 text-left">
                <div>{model.name}</div>
                <div className="text-[9px] text-norma-textDim">
                  {model.desc}
                </div>
              </div>
              {selected.id === model.id && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MarkdownComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }: any) => (
    <h1 className="text-sm font-bold mb-2 text-norma-text">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[13px] font-bold mb-1.5 text-norma-text">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[12px] font-semibold mb-1 text-norma-text">
      {children}
    </h3>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: any) => <li className="text-[12px]">{children}</li>,
  code: ({ children, className }: any) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[11px] font-mono text-norma-accent">
        {children}
      </code>
    ) : (
      <code className={`${className || ""} text-[11px]`}>{children}</code>
    );
  },
  pre: ({ children }: any) => (
    <pre className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3 overflow-x-auto mb-2 text-[11px] font-mono">
      {children}
    </pre>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-norma-accent hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-norma-accent/40 pl-3 my-2 text-norma-textMuted">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full text-[11px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-white/[0.06] px-2 py-1 bg-white/[0.03] text-left">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border border-white/[0.06] px-2 py-1">{children}</td>
  ),
};

const AssistantMessage: React.FC = () => {
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

const getCommandIcon = (cmd: string) => {
  switch (cmd) {
    case "/screen":
      return <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>;
    case "/action":
      return <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>;
    case "/file":
      return <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>;
    case "/search":
      return <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>;
    case "/code":
      return <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>;
    case "/help":
      return <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>;
    default:
      return <><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></>;
  }
};

const getAgentIcon = (agent: string) => {
  switch (agent.toLowerCase()) {
    case "@norma":
      return <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>;
    case "@coder":
      return <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>;
    case "@screen":
      return <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>;
    default:
      return <><rect width="18" height="14" x="3" y="8" rx="2" /><path d="M12 5a3 3 0 1 0-3 3" /><line x1="9" x2="15" y1="15" y2="15" /><line x1="9" x2="9.01" y1="12" y2="12" /><line x1="15" x2="15.01" y1="12" y2="12" /></>;
  }
};

const UserMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%]">
        <div className="bubble bubble-user">
          <div className="flex flex-col gap-[5px] w-full min-w-0">
            <MessagePrimitive.Content
              components={{
              Text: ({ text }) => {
                // 渲染高亮的命令和提及
                const renderHighlightedText = (content: string) => {
                  const parts = content.split(
                    /(\/[a-zA-Z0-9_-]+|@[a-zA-Z0-9_-]+)/g,
                  );
                  return parts.map((part, i) => {
                    if (part.startsWith("/")) {
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-black/20 text-white/90 font-mono text-[11px] align-bottom mx-0.5 border border-black/10 shadow-sm leading-none mt-0.5"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 opacity-70">
                            {getCommandIcon(part)}
                          </svg>
                          {part.slice(1)}
                        </span>
                      );
                    }
                    if (part.startsWith("@")) {
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/20 text-white font-medium text-[11px] align-bottom mx-0.5 border border-white/20 shadow-sm leading-none mt-0.5"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 opacity-70">
                            {getAgentIcon(part)}
                          </svg>
                          {part.slice(1)}
                        </span>
                      );
                    }
                    return part;
                  });
                };

                return (
                  <span className="whitespace-pre-wrap text-[12px] leading-relaxed">
                    {renderHighlightedText(text)}
                  </span>
                );
              },
              File: () => <FilePartView />,
              Image: () => <ImagePartView />,
            }}
          />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const ThreadMessage: React.FC = () => {
  const role = useAuiState((s: any) => s.message.role);
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
};

const ComposerAttachmentItem: React.FC = () => {
  return (
    <ComposerPrimitive.AttachmentByIndex>
      <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-1.5 text-[10px]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-norma-textMuted flex-none"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
        <span className="text-norma-text truncate flex-1">
          <ComposerPrimitive.AttachmentByIndex.Name />
        </span>
        <ComposerPrimitive.AttachmentByIndex.Remove className="text-norma-textDim hover:text-red-400 transition-colors cursor-pointer flex-none">
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
        </ComposerPrimitive.AttachmentByIndex.Remove>
      </div>
    </ComposerPrimitive.AttachmentByIndex>
  );
};

const ContextRing: React.FC = () => {
  return (
    <div className="relative group flex items-center justify-center flex-none w-6 h-6 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer">
      <svg className="w-3.5 h-3.5 transform -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="100 100" strokeDashoffset="58" className="text-emerald-400" />
      </svg>
      
      <div className="absolute bottom-full left-0 mb-3 w-48 p-3 rounded-xl bg-norma-panel border border-norma-border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="flex items-center justify-between text-[11px] text-norma-text font-medium mb-2">
          <span>Usage</span>
          <span>42%</span>
        </div>
        <div className="space-y-1.5 text-[10px]">
          <div className="flex justify-between text-norma-textMuted">
            <span>Input</span>
            <span className="text-norma-textDim">53.8k</span>
          </div>
          <div className="flex justify-between text-norma-textMuted">
            <span>Cached</span>
            <span className="text-norma-textDim">0</span>
          </div>
          <div className="flex justify-between text-norma-textMuted">
            <span>Output</span>
            <span className="text-norma-textDim">0</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06] flex justify-between text-[10px] font-mono text-norma-textDim">
          <span>Total</span>
          <span>53.8k / 128.0k</span>
        </div>
      </div>
    </div>
  );
};

const ComposerPill: React.FC = () => {
  return (
    <ComposerPrimitive.Root className="composer-pill flex-1 min-w-0">
      <ComposerPrimitive.AttachmentDropzone
        asChild
        className="transition-all duration-200"
      >
        <div className="flex flex-col">
          <ComposerPrimitive.Attachments className="flex flex-wrap gap-1.5">
            {() => <ComposerAttachmentItem />}
          </ComposerPrimitive.Attachments>

          <ComposerPrimitive.If dictation>
            <div className="flex items-center gap-2 px-1 py-1 text-[11px] text-norma-textMuted">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-none" />
              <ComposerPrimitive.DictationTranscript className="flex-1 text-norma-textDim italic" />
              <ComposerPrimitive.StopDictation className="text-norma-textDim hover:text-red-400 transition-colors cursor-pointer">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </ComposerPrimitive.StopDictation>
            </div>
          </ComposerPrimitive.If>

          <ComposerPrimitive.Unstable_TriggerPopoverRoot>
            <SlashCommandTrigger />
            <MentionTrigger />
            <div className="flex items-center gap-2 relative w-full">
              <ContextRing />
              <ComposerPrimitive.Input
                placeholder="让 Norma 帮你做点什么...  输入 / 命令  @ 指定智能体"
                rows={1}
                className="flex-1 min-w-0 break-words bg-transparent text-[12px] text-norma-text placeholder-norma-textMuted
                           outline-none resize-none leading-relaxed min-h-[20px] max-h-[120px] py-0.5"
              />

              <VoiceButton />

              <AuiIf condition={(s: any) => !s.thread.isRunning}>
                <ComposerPrimitive.Send
                  className="flex-none p-1.5 rounded-full transition-all duration-200
                             bg-norma-accent text-white hover:opacity-90
                             disabled:bg-white/[0.05] disabled:text-norma-textDim disabled:cursor-not-allowed"
                  title="发送"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 7-7 7 7" />
                    <path d="M12 19V5" />
                  </svg>
                </ComposerPrimitive.Send>
              </AuiIf>
              <AuiIf condition={(s: any) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel
                  className="flex-none p-1.5 rounded-full bg-norma-accent text-white hover:opacity-90 transition-all duration-200"
                  title="停止生成"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </ComposerPrimitive.Cancel>
              </AuiIf>
            </div>
          </ComposerPrimitive.Unstable_TriggerPopoverRoot>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const WelcomeSuggestions: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-2 w-full max-w-[400px] mx-auto pb-4">
      <ThreadPrimitive.Suggestions>
        {() => <SuggestionItem />}
      </ThreadPrimitive.Suggestions>
    </div>
  );
};

const SuggestionItem: React.FC = () => {
  return (
    <SuggestionPrimitive.Trigger
      send
      className="text-left rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06] transition-colors"
    >
      <div className="text-[11px] font-medium text-norma-text">
        <SuggestionPrimitive.Title />
      </div>
      <div className="text-[10px] text-norma-textMuted mt-0.5">
        <SuggestionPrimitive.Description />
      </div>
    </SuggestionPrimitive.Trigger>
  );
};

const AutoScrollHelper: React.FC = () => {
  const { scrollToBottom } = useThreadViewportAutoScroll({ smooth: true });
  return null;
};

const ChatAreaInner: React.FC = () => {
  const [activeNav, setActiveNav] = useState("chat");
  const [activeSession, setActiveSession] = useState("1");

  return (
    <div className="glass-root titlebar-drag h-screen w-screen p-[5px] gap-[5px] flex">
      <LeftIsland
        activeNav={activeNav}
        onNavChange={setActiveNav}
        activeSession={activeSession}
        onSessionChange={setActiveSession}
      />
      <div className="glass-island-right titlebar-no-drag flex-1 h-full flex flex-col overflow-hidden relative">
        <ReadScreenTool />
        <ExecuteActionTool />
        <ContextDisplay />

        <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3 min-h-0 scroll-smooth">
            <AutoScrollHelper />
            <AuiIf condition={(s: any) => s.thread.isEmpty}>
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-norma-accentMuted flex items-center justify-center">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="hsl(215, 90%, 68%)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 8V4H8" />
                      <rect width="16" height="12" x="4" y="8" rx="2" />
                      <path d="M2 14h2" />
                      <path d="M20 14h2" />
                      <path d="M15 13v2" />
                      <path d="M9 13v2" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-norma-text mb-1.5">
                    欢迎使用 Norma
                  </h2>
                  <p className="text-[12px] text-norma-textMuted max-w-[260px]">
                    你的本地智能助手，可以感知屏幕、操控电脑、管理工作流。
                  </p>
                </div>
                <WelcomeSuggestions />
              </div>
            </AuiIf>
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
            <ThreadPrimitive.ScrollToBottom className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-norma-panel border border-norma-border flex items-center justify-center text-norma-textMuted hover:text-norma-text transition-colors shadow-lg disabled:invisible">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.Viewport>

          <div className="flex-none px-5 pb-3 pt-1 flex justify-center relative w-full">
            <div className="absolute left-5 bottom-3.5">
              <ModelSelector />
            </div>
            <div className="flex items-center gap-2 w-full max-w-[620px]">
              <ComposerPill />
              <ComposerPrimitive.AddAttachment
                className="flex-none p-2 rounded-full text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06] transition-colors"
                title="添加附件"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </ComposerPrimitive.AddAttachment>
            </div>
          </div>
        </ThreadPrimitive.Root>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <NormaRuntime>
      <ChatAreaInner />
    </NormaRuntime>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
