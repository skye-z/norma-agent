import React from "react";
import {
  useLocalRuntime,
  AssistantRuntimeProvider,
  useAui,
  Suggestions,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react";
import { createIpcChatModel } from "../lib/ipc-chat";
import { getActiveThreadId } from "../lib/shared";

export function IpcRuntime({ children }: { children: React.ReactNode }) {
  const ipcModel = React.useMemo(() => createIpcChatModel(), []);
  const runtime = useLocalRuntime(ipcModel, {
    maxSteps: 3,
    adapters: {
      dictation: new WebSpeechDictationAdapter(),
    },
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

export function NormaRuntime({ children }: { children: React.ReactNode }) {
  const ipcModel = React.useMemo(() => createIpcChatModel(() => getActiveThreadId()), []);
  const runtime = useLocalRuntime(ipcModel, {
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
