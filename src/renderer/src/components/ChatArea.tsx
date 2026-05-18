import React, { useState, useEffect, useRef } from "react";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  useThread,
  useThreadRuntime,
} from "@assistant-ui/react";
import { LeftIsland, type Session } from "./LeftIsland";
import { WindowControls } from "./WindowControls";
import { ReadScreenTool } from "./tools/ReadScreenTool";
import { ExecuteActionTool } from "./tools/ExecuteActionTool";
import {
  AutoScrollHelper,
  WelcomeSuggestions,
} from "./chat-helpers";
import { ThreadMessage } from "./messages/ThreadMessage";
import { ComposerPill } from "./composer/ComposerPill";
import { QueueDisplay } from "./composer/QueueDisplay";
import { PlanTodo } from "./composer/PlanTodo";
import { useMessageQueue } from "../lib/queue";

import { ModelSelector } from "./composer/ModelSelector";
import { AutomationPage } from "./pages/AutomationPage";
import { CapabilitiesPage } from "./pages/CapabilitiesPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { SettingsPage } from "./pages/SettingsPage";
import { useDbState, setActiveThreadId, requestThreadSwitch, onThreadSwitchRequest } from "../lib/shared";
import { onThreadCreated, onRunningChange, isCurrentlyRunning } from "../lib/ipc-chat";
import { getAssistantRuntime } from "./runtime";

const AutoQueueSender: React.FC = () => {
  const thread = useThread();
  const runtime = useThreadRuntime();
  const { dequeueFirst, queue } = useMessageQueue();
  const prevRunning = useRef(thread.isRunning);

  useEffect(() => {
    if (prevRunning.current && !thread.isRunning && queue.length > 0) {
      const msg = dequeueFirst();
      if (msg) {
        runtime.append({
          role: "user",
          content: [{ type: "text", text: msg }],
        });
      }
    }
    prevRunning.current = thread.isRunning;
  }, [thread.isRunning, queue.length]);

  return null;
};

const ThreadSwitchHandler: React.FC = () => {
  useEffect(() => {
    return onThreadSwitchRequest(async (req) => {
      const runtime = getAssistantRuntime();
      if (!runtime) return;

      if (req.type === "new") {
        runtime.threads.switchToNewThread();
      } else {
        runtime.threads.switchToNewThread();
        try {
          const mastraMessages = await (window as any).electronAPI?.getThreadMessages?.(req.threadId);
          if (mastraMessages && mastraMessages.length > 0) {
            const messages = mastraMessages.map((m: any) => {
              let content = m.content;
              if (content && typeof content === 'object' && Array.isArray(content.parts)) {
                content = content.parts.map((p: any) => {
                  if (p.type === 'text') return { type: 'text', text: p.text };
                  if (p.type === 'tool-invocation') {
                    const inv = p.toolInvocation ?? {};
                    const part: any = {
                      type: 'tool-call',
                      toolCallId: inv.toolCallId ?? p.toolCallId,
                      toolName: inv.toolName ?? p.toolName,
                      args: inv.args ?? p.args ?? {},
                    };
                    if (inv.state === 'result' && inv.result !== undefined) {
                      part.result = inv.result;
                    }
                    return part;
                  }
                  if (p.type === 'step-start' || p.type === 'reasoning') return null;
                  return p;
                }).filter(Boolean);
              } else if (typeof content === 'string') {
                content = [{ type: "text", text: content }];
              }
              if (!Array.isArray(content)) return null;
              return { role: m.role, content };
            }).filter(Boolean);
            if (messages.length > 0) {
              runtime.thread.reset(messages);
            }
          }
        } catch (e) {
          console.error("Failed to load thread messages:", e);
        }
      }
    });
  }, []);

  return null;
};

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return "刚刚";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "刚刚";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

const WelcomeScreen = () => (
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
);

const ChatAreaInner: React.FC = () => {
  const [activeNav, setActiveNav] = useState("chat");
  const [sessions, setSessions] = useDbState<Session[]>("norma-sessions", []);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isRunning, setIsRunning] = useState(isCurrentlyRunning);
  const prevActiveIdRef = useRef(activeSessionId);

  const isNewSession = activeSessionId === "" || !sessions.find(s => s.id === activeSessionId);
  const showWelcome = isNewSession && activeNav === "chat";

  useEffect(() => {
    return onRunningChange(setIsRunning);
  }, []);

  useEffect(() => {
    const syncThreads = async () => {
      try {
        const threads = (await window.electronAPI?.listThreads?.()) || [];
        setSessions((prev) => {
          const existingThreadIds = new Set(
            prev.filter((s) => s.threadId).map((s) => s.threadId),
          );
          const newFromThreads = threads
            .filter((t) => !existingThreadIds.has(t.id))
            .map((t) => ({
              id: `thread-${t.id}`,
              title: t.title || "新会话",
              preview: "",
              time: formatTimeAgo(t.createdAt),
              threadId: t.id,
              status: "idle" as const,
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
    };

    syncThreads();
    const interval = setInterval(syncThreads, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    if (activeSession?.threadId) {
      setActiveThreadId(activeSession.threadId);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (prevActiveIdRef.current && prevActiveIdRef.current !== activeSessionId && isRunning) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === prevActiveIdRef.current ? { ...s, status: "unread" as const } : s,
        ),
      );
    }
    prevActiveIdRef.current = activeSessionId;
  }, [activeSessionId, isRunning]);

  useEffect(() => {
    return onThreadCreated((threadId, title, preview) => {
      const displayTitle = (!title || title === "新会话") && preview
        ? preview.slice(0, 30) + (preview.length > 30 ? "..." : "")
        : (title || "新会话");
      const newSession: Session = {
        id: `thread-${threadId}`,
        title: displayTitle,
        preview: preview || "",
        time: "刚刚",
        threadId,
        status: "running",
      };
      setSessions((prev) => {
        const exists = prev.some((s) => s.threadId === threadId);
        if (exists) return prev;
        return [...prev, newSession];
      });
      setActiveSessionId(newSession.id);
    });
  }, []);

  const handleNewSession = () => {
    setActiveSessionId("");
    setActiveThreadId(undefined);
    setActiveNav("chat");
    requestThreadSwitch({ type: "new" });
  };

  const handleDeleteSession = async (id: string, confirm?: boolean) => {
    if (!confirm) {
      setSessions((prev) =>
        prev.map((s) => s.id === id ? { ...s, confirmDelete: true } : s),
      );
      setTimeout(() => {
        setSessions((prev) =>
          prev.map((s) => s.id === id ? { ...s, confirmDelete: false } : s),
        );
      }, 3000);
      return;
    }
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
        setActiveSessionId(next[0].id);
        setActiveThreadId(next[0].threadId);
      }
      return next;
    });
  };

  const handleSwitchSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    setActiveSessionId(id);
    setActiveThreadId(session.threadId);
    setActiveNav("chat");
    setSessions((prev) =>
      prev.map((s) => (s.id === id && s.status === "unread" ? { ...s, status: "idle" as const } : s)),
    );

    if (session.threadId) {
      requestThreadSwitch({ type: "switch", threadId: session.threadId });
    }
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
        isRunning={isRunning}
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

            <ThreadPrimitive.Root className="flex-1 flex flex-col min-h-0">
              <AutoQueueSender />
              <ThreadSwitchHandler />
              <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3 min-h-0 scroll-smooth">
                <AutoScrollHelper />
                {showWelcome && <WelcomeScreen />}
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
                  <div className="w-full max-w-[620px] flex flex-col">
                    <QueueDisplay />
                    <PlanTodo />
                  </div>
                </div>
                <div className="grid grid-cols-[160px_1fr_100px] items-end w-full">
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
