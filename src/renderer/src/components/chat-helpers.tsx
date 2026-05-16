import React from "react";
import { ThreadPrimitive, SuggestionPrimitive, useThreadModelContext, useThreadViewportAutoScroll } from "@assistant-ui/react";

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
  useThreadViewportAutoScroll({});
  return null;
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

export { WelcomeSuggestions, AutoScrollHelper, ContextDisplay };
