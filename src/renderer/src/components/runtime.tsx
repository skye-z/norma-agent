import React from "react";
import {
  useLocalRuntime,
  AssistantRuntimeProvider,
  useAui,
  Suggestions,
  WebSpeechDictationAdapter,
  WebSpeechSynthesisAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  CompositeAttachmentAdapter,
} from "@assistant-ui/react";
import type { AssistantRuntime } from "@assistant-ui/react";
import { createIpcChatModel } from "../lib/ipc-chat";
import { getActiveThreadId } from "../lib/shared";

let _runtimeRef: AssistantRuntime | null = null;
export function getAssistantRuntime() { return _runtimeRef; }

function syncActiveModelConfig(force?: boolean) {
  Promise.all([
    (window as any).electronAPI?.getActiveModel?.() ?? Promise.resolve(null),
    (window as any).electronAPI?.configGet?.("norma-providers") ?? Promise.resolve(null),
    (window as any).electronAPI?.configGet?.("norma-enabled-models") ?? Promise.resolve(null),
  ]).then(([activeModel, providersRaw, enabledRaw]) => {
    if (activeModel && !force) return;
    const providers = Array.isArray(providersRaw) ? providersRaw : [];
    const enabled = Array.isArray(enabledRaw) ? enabledRaw : [];
    if (enabled.length === 0) return;
    const em = enabled[0];
    const prov = providers.find((p: any) => p.id === em.providerId);
    if (!prov) return;
    const providerType = prov.type || (prov.presetId === 'custom' ? 'openai' : prov.presetId);
    const modelString = `${providerType}/${em.modelId}`;
    (window as any).electronAPI?.setActiveModel?.(modelString, {
      providerType,
      baseUrl: prov.baseUrl || '',
      apiKey: prov.apiKey || '',
    });
  }).catch(() => {});
}

const CONFIG_KEYS = ['norma-providers', 'norma-enabled-models'];

function useConfigSync() {
  React.useEffect(() => {
    syncActiveModelConfig();
    const unsub = (window as any).electronAPI?.onConfigChanged?.((key: string) => {
      if (CONFIG_KEYS.includes(key)) {
        syncActiveModelConfig(true);
      }
    });
    return () => { unsub?.(); };
  }, []);
}

function useMaxSteps(defaultValue: number): number {
  const [maxSteps, setMaxSteps] = React.useState(() => {
    try {
      const stored = localStorage.getItem("norma-max-steps");
      return stored ? Number(stored) || defaultValue : defaultValue;
    } catch { return defaultValue; }
  });

  React.useEffect(() => {
    const unsub = (window as any).electronAPI?.onConfigChanged?.((key: string) => {
      if (key === 'norma-max-steps') {
        (window as any).electronAPI?.configGet?.('norma-max-steps').then((val: any) => {
          if (typeof val === 'number') {
            setMaxSteps(val);
            try { localStorage.setItem('norma-max-steps', String(val)); } catch {}
          }
        }).catch(() => {});
      }
    });
    return () => { unsub?.(); };
  }, []);

  return maxSteps;
}

export function IpcRuntime({ children }: { children: React.ReactNode }) {
  const ipcModel = React.useMemo(() => createIpcChatModel(), []);
  const dictationAdapter = React.useMemo(() => new WebSpeechDictationAdapter(), []);
  const maxSteps = useMaxSteps(3);
  useConfigSync();
  const runtime = useLocalRuntime(ipcModel, {
    maxSteps,
    adapters: {
      dictation: dictationAdapter,
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
  const dictationAdapter = React.useMemo(() => new WebSpeechDictationAdapter(), []);
  const speechAdapter = React.useMemo(() => new WebSpeechSynthesisAdapter(), []);
  const imageAttachmentAdapter = React.useMemo(() => new SimpleImageAttachmentAdapter(), []);
  const textAttachmentAdapter = React.useMemo(() => new SimpleTextAttachmentAdapter(), []);
  const attachmentAdapter = React.useMemo(
    () => new CompositeAttachmentAdapter([imageAttachmentAdapter, textAttachmentAdapter]),
    [imageAttachmentAdapter, textAttachmentAdapter],
  );
  const maxSteps = useMaxSteps(5);
  useConfigSync();

  const feedbackAdapter = React.useMemo(() => ({
    submit: ({ type }: { message: any; type: "positive" | "negative" }) => {
      console.log(`[Feedback] ${type}`);
    },
  }), []);

  const runtime = useLocalRuntime(ipcModel, {
    maxSteps,
    adapters: {
      dictation: dictationAdapter,
      speech: speechAdapter,
      attachments: attachmentAdapter,
      feedback: feedbackAdapter,
    },
  });
  _runtimeRef = runtime;

  const [suggestions, setSuggestions] = React.useState([
    { title: "分析屏幕", label: "读取当前屏幕内容", prompt: "帮我分析当前屏幕上的内容" },
    { title: "整理文件", label: "自动分类下载目录", prompt: "帮我把下载目录里的文件按类型整理" },
    { title: "写代码", label: "根据描述生成代码", prompt: "帮我写一个 React 组件" },
    { title: "查文档", label: "搜索技术文档", prompt: "帮我查一下 Electron 的 IPC 通信方式" },
  ]);

  React.useEffect(() => {
    window.electronAPI?.getCapabilities?.().then((caps: Array<{ id: string; name: string; description: string }>) => {
      if (!caps || caps.length === 0) return;
      setSuggestions(caps.slice(0, 4).map(c => ({
        title: c.name,
        label: c.description,
        prompt: `帮我使用${c.name}功能`,
      })));
    }).catch(() => {});
  }, []);

  const aui = useAui({
    suggestions: Suggestions(suggestions),
  });

  return (
    <AssistantRuntimeProvider aui={aui} runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
