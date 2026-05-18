import React from "react";
import {
  MessageSquare,
  Zap,
  Layers,
  BookOpen,
  Settings,
  Plus,
  Trash2,
} from "lucide-react";

const isMac = window.electronAPI?.platform === "darwin";

const navItems = [
  {
    id: "chat",
    label: "对话",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  {
    id: "capabilities",
    label: "能力",
    icon: <Layers className="w-3.5 h-3.5" />,
  },
  { id: "automation", label: "自动化", icon: <Zap className="w-3.5 h-3.5" /> },
  {
    id: "knowledge",
    label: "知识库",
    icon: <BookOpen className="w-3.5 h-3.5" />,
  },
];

export interface Session {
  id: string;
  title: string;
  preview: string;
  time: string;
  threadId?: string;
  status: "idle" | "running" | "unread";
}

interface LeftIslandProps {
  activeNav?: string;
  onNavChange?: (id: string) => void;
  sessions?: Session[];
  activeSessionId?: string;
  isRunning?: boolean;
  onNewSession?: () => void;
  onDeleteSession?: (id: string) => void;
  onSwitchSession?: (id: string) => void;
}

export const LeftIsland: React.FC<LeftIslandProps> = ({
  activeNav = "chat",
  onNavChange,
  sessions = [],
  activeSessionId,
  isRunning = false,
  onNewSession,
  onDeleteSession,
  onSwitchSession,
}) => {
  return (
    <div className="glass-island-left titlebar-no-drag w-[240px] flex-none h-full flex flex-col overflow-hidden">
      {isMac && <div className="titlebar-drag h-[24px] flex-none" />}

      <nav className="flex-none px-2 py-2 flex flex-col gap-[5px]">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeNav === item.id ? "active" : ""}`}
            onClick={() => onNavChange?.(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="hairline mx-3" />

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-[10px] font-medium text-norma-textMuted uppercase tracking-wider">
            会话历史
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-norma-textDim">
              {sessions.length}
            </span>
            <button
              onClick={onNewSession}
              className="p-0.5 rounded hover:bg-white/[0.06] text-norma-textDim hover:text-norma-textMuted transition-colors"
              title="新建会话"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isSessionRunning = isActive && isRunning;
            const isUnread = session.status === "unread";
            return (
              <div
                key={session.id}
                className={`session-card group ${isActive ? "active" : ""}`}
                onClick={() => onSwitchSession?.(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isSessionRunning && (
                        <span className="w-1.5 h-1.5 rounded-full bg-norma-accent animate-pulse flex-none" />
                      )}
                      {isUnread && !isSessionRunning && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-none" />
                      )}
                      <span className="text-[12px] font-medium text-norma-text leading-tight truncate">
                        {session.title}
                      </span>
                    </div>
                    <div className="text-[9px] text-norma-textDim mt-0.5 font-mono">
                      {session.time}前
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession?.(session.id);
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-norma-textDim hover:text-red-400 transition-all flex-none ml-1"
                    title="删除会话"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <div className="text-[10px] text-norma-textDim px-1 py-3 text-center">
              开始对话后将自动创建会话
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto" />

      <div className="hairline mx-3" />

      <div className="flex-none px-2 py-2">
        <div
          className={`nav-item ${activeNav === "settings" ? "active" : ""}`}
          onClick={() => onNavChange?.("settings")}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>设置</span>
        </div>
      </div>
    </div>
  );
};
