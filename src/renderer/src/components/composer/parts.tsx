import React from "react";
import { ComposerPrimitive } from "@assistant-ui/react";

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
          strokeDasharray="100 100"
          strokeDashoffset="58"
          className="text-emerald-400"
        />
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

export { ComposerAttachmentItem, ContextRing, VoiceButton };
