import React, { useState, useEffect } from "react";
import { ComposerPrimitive } from "@assistant-ui/react";
import { lastUsage, onUsageUpdate, UsageData } from "../../lib/ipc-chat";

const formatTokens = (n: number): string => {
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(n);
};

const ComposerAttachmentItem: React.FC = () => {
  return (
    <ComposerPrimitive.AttachmentByIndex>
      <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-1.5 text-[12px]">
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
  const [usage, setUsage] = useState<UsageData>(lastUsage);
  const [contextWindow, setContextWindow] = useState(128000);

  useEffect(() => {
    setUsage(lastUsage);
    return onUsageUpdate((u) => setUsage({ ...u }));
  }, []);

  useEffect(() => {
    const fetchContextWindow = async () => {
      const activeModel = await window.electronAPI?.getActiveModel?.();
      if (!activeModel) return;
      const modelId = activeModel.includes("/") ? activeModel.split("/").pop()! : activeModel;
      const caps = await window.electronAPI?.getCapabilitiesWithOverride?.(modelId);
      if (caps && caps.contextLength > 0) {
        setContextWindow(caps.contextLength);
      }
    };
    fetchContextWindow();
    const unsub = window.electronAPI?.onConfigChanged?.((key) => {
      if (key === "norma-active-model" || key === "norma-enabled-models") {
        fetchContextWindow();
      }
    });
    return () => {
      unsub?.();
    };
  }, []);

  const promptTokens = usage.promptTokens;
  const completionTokens = usage.completionTokens;
  const cachedTokens = usage.cachedTokens ?? 0;
  const totalUsed = promptTokens + completionTokens;
  const percentage = Math.min(100, (promptTokens / contextWindow) * 100);
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference * (1 - percentage / 100);

  const ringColor =
    percentage > 80
      ? "text-red-400"
      : percentage > 50
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="relative group flex items-center justify-center flex-none w-6 h-6 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer">
      <svg className="w-3.5 h-3.5 transform -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          className={ringColor}
        />
      </svg>

      <div className="absolute bottom-full left-0 mb-3 w-48 p-3 rounded-xl bg-[#1c1c20] border border-white/[0.08] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="flex items-center justify-between text-[13px] text-norma-text font-medium mb-2">
          <span>Usage</span>
          <span>{promptTokens > 0 ? `${Math.round(percentage)}%` : "—"}</span>
        </div>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex justify-between text-norma-textMuted">
            <span>Input</span>
            <span className="text-norma-textDim">{promptTokens > 0 ? formatTokens(promptTokens) : "—"}</span>
          </div>
          <div className="flex justify-between text-norma-textMuted">
            <span>Cached</span>
            <span className="text-norma-textDim">{cachedTokens > 0 ? formatTokens(cachedTokens) : "0"}</span>
          </div>
          <div className="flex justify-between text-norma-textMuted">
            <span>Output</span>
            <span className="text-norma-textDim">{completionTokens > 0 ? formatTokens(completionTokens) : "—"}</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06] flex justify-between text-[12px] font-mono text-norma-textDim">
          <span>Total</span>
          <span>{totalUsed > 0 ? `${formatTokens(totalUsed)} / ${formatTokens(contextWindow)}` : "—"}</span>
        </div>
      </div>
    </div>
  );
};

const VoiceButton: React.FC = () => {
  const [listening, setListening] = React.useState(false);
  const unsubRef = React.useRef<(() => void)[]>([]);

  React.useEffect(() => {
    return () => { unsubRef.current.forEach(u => u()); };
  }, []);

  const toggleListen = React.useCallback(async () => {
    if (listening) {
      window.electronAPI?.speechStop?.();
      setListening(false);
      unsubRef.current.forEach(u => u());
      unsubRef.current = [];
      return;
    }

    const available = await window.electronAPI?.speechAvailable?.();
    if (!available) {
      return;
    }

    setListening(true);
    const onPartial = window.electronAPI?.onSpeechPartial?.((data) => {});
    const onResult = window.electronAPI?.onSpeechResult?.((data) => {
      if (data.success && data.text) {
        const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="composer-textarea"], textarea.composer-input, textarea');
        if (textarea) {
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(textarea, textarea.value + (textarea.value ? ' ' : '') + data.text);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
      setListening(false);
    });
    const onDone = window.electronAPI?.onSpeechDone?.(() => { setListening(false); });
    const onError = window.electronAPI?.onSpeechError?.(() => { setListening(false); });

    unsubRef.current = [onPartial, onResult, onDone, onError].filter(Boolean) as (() => void)[];

    window.electronAPI?.speechStart?.(60);
  }, [listening]);

  return (
    <button
      onClick={toggleListen}
      className={`flex-none p-1.5 rounded-full transition-colors ${listening ? 'text-red-400 bg-red-400/10 animate-pulse' : 'text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06]'}`}
      title={listening ? '停止录音' : '语音输入'}
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
    </button>
  );
};

export { ComposerAttachmentItem, ContextRing, VoiceButton };
