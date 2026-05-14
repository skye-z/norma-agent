import React from 'react';
import { MessageSquare, Zap, Layers, BookOpen, Settings } from 'lucide-react';

const navItems = [
  { id: 'chat', label: '对话', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'automation', label: '自动化', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'capabilities', label: '能力', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'knowledge', label: '知识库', icon: <BookOpen className="w-3.5 h-3.5" /> },
];

const sessions = [
  { id: '1', title: '屏幕分析', preview: '读取屏幕上的错误信息...', time: '2分钟', active: true },
  { id: '2', title: '文件整理', preview: '按日期排序下载目录...', time: '15分钟' },
  { id: '3', title: '接口联调', preview: '配置 REST 端点...', time: '1小时' },
  { id: '4', title: '调试会话', preview: '追踪空指针异常...', time: '3小时' },
];

interface LeftIslandProps {
  activeNav?: string;
  onNavChange?: (id: string) => void;
  activeSession?: string;
  onSessionChange?: (id: string) => void;
}

export const LeftIsland: React.FC<LeftIslandProps> = ({
  activeNav = 'chat',
  onNavChange,
  activeSession = '1',
  onSessionChange,
}) => {
  return (
    <div className="glass-island-left titlebar-no-drag w-[240px] flex-none h-full flex flex-col overflow-hidden">
      <div className="titlebar-drag h-[36px] flex-none" />

      <nav className="flex-none px-2 pb-2 flex flex-col gap-[5px]">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
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
          <span className="text-[10px] font-medium text-norma-textMuted uppercase tracking-wider">会话历史</span>
          <span className="text-[10px] text-norma-textDim">{sessions.length}</span>
        </div>
        <div className="flex flex-col gap-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-card ${activeSession === session.id ? 'active' : ''}`}
              onClick={() => onSessionChange?.(session.id)}
            >
              <div className="text-[12px] font-medium text-norma-text leading-tight truncate">
                {session.title}
              </div>
              <div className="text-[10px] text-norma-textMuted leading-tight truncate mt-0.5">
                {session.preview}
              </div>
              <div className="text-[9px] text-norma-textDim mt-0.5 font-mono">
                {session.time}前
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hairline mx-3" />

      <div className="flex-none px-2 py-2">
        <div className="nav-item">
          <Settings className="w-3.5 h-3.5" />
          <span>设置</span>
        </div>
      </div>
    </div>
  );
};
