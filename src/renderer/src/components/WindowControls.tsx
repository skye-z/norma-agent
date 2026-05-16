import React from 'react';
import { X, Minus } from 'lucide-react';

const isMac = window.electronAPI?.platform === 'darwin';

export const WindowControls: React.FC = () => {
  if (isMac) return null;

  return (
    <div className="titlebar-no-drag flex items-center gap-0.5 absolute top-0 right-0 z-50">
      <button
        onClick={() => window.electronAPI.minimizeWindow()}
        className="w-[34px] h-[28px] flex items-center justify-center text-norma-textDim hover:text-norma-text hover:bg-white/[0.06] transition-colors"
        title="最小化"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        onClick={() => window.electronAPI.hideWindow()}
        className="w-[34px] h-[28px] flex items-center justify-center text-norma-textDim hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title="关闭"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
