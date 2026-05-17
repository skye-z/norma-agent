import { useState, useEffect, useCallback } from "react";

const _state = { activeThreadId: undefined as string | undefined };
export function getActiveThreadId() { return _state.activeThreadId; }
export function setActiveThreadId(id: string | undefined) { _state.activeThreadId = id; }

export const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d4a27f",
  deepseek: "#4d6bfe",
  google: "#4285f4",
  longcat: "#ff6a00",
  mimo: "#ff6900",
  openrouter: "#6d28d9",
  ollama: "#6366f1",
  custom: "#8b8b8b",
};

export function getMaxSteps(defaultValue: number): number {
  try {
    const stored = localStorage.getItem("norma-max-steps");
    if (stored) return Number(stored) || defaultValue;
  } catch {}
  return defaultValue;
}

export function getSlashCommandsFromCapabilities(caps: Array<{ id: string; name: string }>) {
  return caps.map(c => ({
    command: `/${c.id}`,
    description: c.name,
  }));
}

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
    (window as any).electronAPI?.configSet?.(key, value).catch(() => {});
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}

export function useDbState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (window as any).electronAPI?.configGet?.(key).then((stored: any) => {
      if (stored !== null && stored !== undefined) {
        try { setValue(typeof stored === 'string' ? JSON.parse(stored) : stored); } catch { setValue(stored); }
      } else {
        try {
          const ls = localStorage.getItem(key);
          if (ls) {
            const parsed = JSON.parse(ls);
            setValue(parsed);
            (window as any).electronAPI?.configSet?.(key, parsed);
          }
        } catch {}
      }
      setLoaded(true);
    }).catch(() => {
      try {
        const ls = localStorage.getItem(key);
        if (ls) setValue(JSON.parse(ls));
      } catch {}
      setLoaded(true);
    });
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    (window as any).electronAPI?.configSet?.(key, value).catch(() => {});
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}
