import React, { useMemo, useState } from "react";
import { useThread } from "@assistant-ui/react";

function extractPlan(text: string): string[] {
  const match = text.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!match) return [];
  const content = match[1].trim();
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const steps: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\.\s+(.+)/);
    if (m) {
      steps.push(m[1]);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      steps.push(line.substring(2));
    } else if (line.length > 5 && !line.startsWith('#')) {
      steps.push(line);
    }
  }
  return steps;
}

function getToolNamesFromMessages(messages: any[]): string[] {
  const tools: string[] = [];
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const content = msg.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part.type === 'tool-call' && part.toolName) {
        tools.push(part.toolName);
      }
    }
  }
  return tools;
}

export const PlanTodo: React.FC = () => {
  const thread = useThread();
  const messages = thread.messages;
  const [collapsed, setCollapsed] = useState(false);

  const { steps, toolsUsed, isRunning } = useMemo(() => {
    let foundSteps: string[] = [];
    let msgIdx = -1;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      const content = msg.content;
      const text = Array.isArray(content)
        ? content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        : typeof content === 'string' ? content : '';
      const s = extractPlan(text);
      if (s.length > 0) {
        foundSteps = s;
        msgIdx = i;
        break;
      }
    }

    const toolsAfterPlan = msgIdx >= 0
      ? getToolNamesFromMessages(messages.slice(msgIdx + 1))
      : [];

    return {
      steps: foundSteps,
      toolsUsed: toolsAfterPlan,
      isRunning: thread.isRunning,
    };
  }, [messages, thread.isRunning]);

  if (steps.length === 0) return null;

  const stepProgress = steps.map((step, i) => {
    if (!isRunning && toolsUsed.length === 0) return 'done' as const;
    const calledTools = toolsUsed.length;
    if (i < calledTools) return 'done' as const;
    if (i === calledTools) return 'active' as const;
    return 'pending' as const;
  });

  const doneCount = stepProgress.filter(s => s === 'done').length;
  const total = steps.length;

  return (
    <div className="w-full max-w-[620px] mb-1.5 sticky top-0 z-20">
      <div className="rounded-xl bg-[#1a1a1f]/95 backdrop-blur-md border border-norma-accent/20 overflow-hidden shadow-lg shadow-black/20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
        >
          <svg
            className={`w-3 h-3 text-norma-accent transition-transform flex-shrink-0 ${collapsed ? "" : "rotate-90"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-norma-accent flex-shrink-0">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="text-[13px] font-medium text-norma-accent/90">
            执行计划
          </span>
          <span className="text-[12px] text-norma-textDim ml-auto">
            {doneCount}/{total}
          </span>
        </button>
        {!collapsed && (
          <div className="px-3 py-1.5 space-y-0.5 max-h-[120px] overflow-y-auto scrollbar-show">
            {steps.map((step, i) => {
              const status = stepProgress[i];
              return (
                <div key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                  <span className="flex-shrink-0 mt-[2px]">
                    {status === 'done' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : status === 'active' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-norma-accent animate-pulse">
                        <circle cx="12" cy="12" r="8" strokeDasharray="4 4" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-norma-textDim/40">
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                    )}
                  </span>
                  <span className={
                    status === 'done'
                      ? 'text-norma-textDim/50 line-through'
                      : status === 'active'
                      ? 'text-norma-text'
                      : 'text-norma-textDim/70'
                  }>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
