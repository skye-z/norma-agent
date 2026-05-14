import React from 'react';
import { X, Minus } from 'lucide-react';

const isMac = window.electronAPI?.platform === 'darwin';

export const WindowControls: React.FC = () => {
  if (isMac) return null;

  return (
    <div className="titlebar-no-drag flex items-center -mr-2">
      <button
        onClick={() => window.electronAPI.minimizeWindow()}
        className="win-btn"
        title="最小化"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        onClick={() => window.electronAPI.hideWindow()}
        className="win-btn win-btn-close"
        title="关闭"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
