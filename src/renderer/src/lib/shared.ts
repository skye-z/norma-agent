import { useState, useEffect } from "react";

const _state = { activeThreadId: undefined as string | undefined };
export function getActiveThreadId() { return _state.activeThreadId; }
export function setActiveThreadId(id: string | undefined) { _state.activeThreadId = id; }

export const SLASH_COMMANDS = [
  { command: "/screen", description: "读取当前屏幕内容" },
  { command: "/action", description: "执行系统操作" },
  { command: "/file", description: "文件管理操作" },
  { command: "/search", description: "搜索知识库" },
  { command: "/code", description: "代码生成与分析" },
  { command: "/help", description: "查看帮助信息" },
];

export const MODELS = [
  { id: "norma-local", name: "Norma Local", desc: "本地模型" },
  { id: "gpt-4o", name: "GPT-4o", desc: "OpenAI" },
  { id: "claude-3.5", name: "Claude 3.5", desc: "Anthropic" },
];

export const AGENTS = [
  { id: "norma", type: "agent", label: "Norma", description: "通用助手" },
  { id: "coder", type: "agent", label: "Coder", description: "代码专家" },
  { id: "screen", type: "agent", label: "Screen", description: "屏幕感知" },
];

export function useStoredState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}
