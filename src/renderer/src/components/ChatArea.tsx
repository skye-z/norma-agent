import React, { useState, useEffect, useRef } from "react";
import { ThreadPrimitive, AuiIf, ComposerPrimitive, useThread, useThreadRuntime } from "@assistant-ui/react";
import { LeftIsland, type Session } from "./LeftIsland";
import { WindowControls } from "./WindowControls";
import { ReadScreenTool } from "./tools/ReadScreenTool";
import { ExecuteActionTool } from "./tools/ExecuteActionTool";
import { ContextDisplay, AutoScrollHelper, WelcomeSuggestions } from "./chat-helpers";
import { ThreadMessage } from "./messages/ThreadMessage";
import { ComposerPill } from "./composer/ComposerPill";
import { QueueDisplay } from "./composer/QueueDisplay";
import { useMessageQueue } from "../lib/queue";

import { ModelSelector } from "./composer/ModelSelector";
import { AutomationPage } from "./pages/AutomationPage";
import { CapabilitiesPage } from "./pages/CapabilitiesPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { SettingsPage } from "./pages/SettingsPage";
import { useDbState, setActiveThreadId } from "../lib/shared";

const AutoQueueSender: React.FC = () => {
  const thread = useThread();
  const runtime = useThreadRuntime();
  const { dequeueFirst, queue } = useMessageQueue();
  const prevRunning = useRef(thread.isRunning);

  useEffect(() => {
    if (prevRunning.current && !thread.isRunning && queue.length > 0) {
      const msg = dequeueFirst();
      if (msg) {
        runtime.append({ role: 'user', content: [{ type: 'text', text: msg }] });
      }
    }
    prevRunning.current = thread.isRunning;
  }, [thread.isRunning, queue.length]);

  return null;
};

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return "刚刚";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时`;
  const days = Math.floor(hours / 24);
  return `${days}天`;
}

const ChatAreaInner: React.FC = () => {
  const [activeNav, setActiveNav] = useState("chat");
  const [sessions, setSessions] = useDbState<Session[]>("norma-sessions", []);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [synced, setSynced] = useState(false);

  const syncThreads = React.useCallback(async () => {
    try {
      const threads = await window.electronAPI?.listThreads?.() || [];
      setSessions((prev) => {
        const existingThreadIds = new Set(prev.filter((s) => s.threadId).map((s) => s.threadId));
        const newFromThreads = threads
          .filter((t) => !existingThreadIds.has(t.id))
          .map((t) => ({
            id: `thread-${t.id}`,
            title: t.title || "新会话",
            preview: "",
            time: formatTimeAgo(t.createdAt),
            active: false,
            threadId: t.id,
          }));
        const merged = prev.map((s) => {
          if (!s.threadId) return s;
          const thread = threads.find((t) => t.id === s.threadId);
          if (thread && thread.title && thread.title !== "新会话") {
            return { ...s, title: thread.title };
          }
          return s;
        });
        return [...merged, ...newFromThreads];
      });
    } catch (e) {
      console.error("Failed to sync threads:", e);
    }
  }, []);

  useEffect(() => {
    if (synced) return;
    let cancelled = false;
    (async () => {
      await syncThreads();
      if (!cancelled) setSynced(true);
    })();
    return () => { cancelled = true; };
  }, [synced, syncThreads]);

  useEffect(() => {
    const interval = setInterval(() => { syncThreads(); }, 30000);
    return () => { clearInterval(interval); };
  }, [syncThreads]);

  useEffect(() => {
    const activeSession = sessions.find((s) => s.active);
    setActiveThreadId(activeSession?.threadId);
  }, [sessions, activeSessionId]);

  const handleNewSession = async () => {
    let threadId: string | undefined;
    try {
      if (window.electronAPI?.createThread) {
        const thread = await window.electronAPI.createThread("新会话");
        threadId = thread.id;
      }
    } catch (e) {
      console.error("Failed to create thread:", e);
    }
    const newSession: Session = {
      id: Date.now().toString(),
      title: "新会话",
      preview: "开始新的对话...",
      time: "刚刚",
      active: true,
      threadId,
    };
    setSessions((prev) =>
      prev.map((s) => ({ ...s, active: false })).concat(newSession),
    );
    setActiveSessionId(newSession.id);
    setActiveNav("chat");
  };

  const handleDeleteSession = async (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session?.threadId) {
      try {
        await window.electronAPI?.deleteThread?.(session.threadId);
      } catch (e) {
        console.error("Failed to delete thread:", e);
      }
    }
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        setActiveThreadId(undefined);
        return next;
      }
      if (id === activeSessionId) {
        next[0].active = true;
        setActiveSessionId(next[0].id);
        setActiveThreadId(next[0].threadId);
      }
      return next;
    });
  };

  const handleSwitchSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) => ({ ...s, active: s.id === id }));
      const session = next.find((s) => s.id === id);
      setActiveThreadId(session?.threadId);
      return next;
    });
    setActiveSessionId(id);
    setActiveNav("chat");
  };

  const isChatPage = activeNav === "chat";

  const renderPage = () => {
    switch (activeNav) {
      case "automation":
        return <AutomationPage />;
      case "capabilities":
        return <CapabilitiesPage />;
      case "knowledge":
        return <KnowledgePage />;
      case "settings":
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="glass-root titlebar-drag h-screen w-screen p-[5px] gap-[5px] flex">
      <LeftIsland
        activeNav={activeNav}
        onNavChange={setActiveNav}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onSwitchSession={handleSwitchSession}
      />
      <div className="glass-island-right titlebar-no-drag flex-1 h-full flex flex-col overflow-hidden relative">
        <WindowControls />
        {isChatPage ? (
          <>
            <ReadScreenTool />
            <ExecuteActionTool />
            <ContextDisplay />

            <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
              <AutoQueueSender />
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

              <div className="flex-none px-5 pb-3 pt-1 flex flex-col w-full">
                <div className="flex justify-center w-full">
                  <div className="w-full max-w-[620px]">
                    <QueueDisplay />
                  </div>
                </div>
                <div className="grid grid-cols-[120px_1fr_120px] items-end w-full">
                  <div className="flex justify-start mb-2">
                    <ModelSelector />
                  </div>
                  <div className="flex justify-center w-full">
                    <div className="flex items-end gap-2 w-full max-w-[620px]">
                      <ComposerPill />
                      <ComposerPrimitive.AddAttachment
                      className="flex-none p-2 mb-1 rounded-full text-norma-textDim hover:text-norma-textMuted hover:bg-white/[0.06] transition-colors"
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
                <div />
              </div>
            </div>
            </ThreadPrimitive.Root>
          </>
        ) : (
          <>{renderPage()}</>
        )}
      </div>
    </div>
  );
};

export { ChatAreaInner };
