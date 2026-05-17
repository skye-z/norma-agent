import React, { useState } from "react";
import { ThreadPrimitive, SuggestionPrimitive, useThreadViewportAutoScroll } from "@assistant-ui/react";
import { lastUsage, lastMetadata, onUsageUpdate } from "../lib/ipc-chat";

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
  const [usage, setUsage] = useState(lastUsage);
  const [meta, setMeta] = useState(lastMetadata);

  React.useEffect(() => {
    const unsub = onUsageUpdate((u) => setUsage({ ...u }));
    return unsub;
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      if (lastMetadata !== meta) setMeta(lastMetadata);
      if (lastUsage !== usage) setUsage(lastUsage);
    }, 500);
    return () => clearInterval(id);
  }, [meta, usage]);

  const modelShort = meta?.model ? meta.model.split('/').pop() || meta.model : '';
  const fmtTok = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="px-3 py-1 text-[9px] text-norma-textDim font-mono truncate border-b border-white/[0.04] flex items-center gap-2">
      {modelShort && <span>{modelShort}</span>}
      {usage.promptTokens > 0 && (
        <>
          {modelShort && <span className="text-white/[0.08]">|</span>}
          <span>↑{fmtTok(usage.promptTokens)}</span>
          <span>↓{fmtTok(usage.completionTokens)}</span>
        </>
      )}
    </div>
  );
};

export { WelcomeSuggestions, AutoScrollHelper, ContextDisplay };
