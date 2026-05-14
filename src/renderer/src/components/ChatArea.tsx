import React, { useRef, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { ChatBubble } from './ChatBubble';
import { InputPill } from './InputPill';
import { WindowControls } from './WindowControls';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface ChatAreaProps {
  messages: Message[];
  input: string;
  isStreaming: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  input,
  isStreaming,
  onInputChange,
  onSend,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="glass-island-right titlebar-no-drag flex-1 h-full flex flex-col overflow-hidden relative">
      <div className="titlebar-drag h-[36px] flex-none flex items-center justify-between px-4">
        <div className="titlebar-no-drag flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-norma-accentMuted flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-norma-accent" />
          </div>
          <div>
            <h1 className="text-[12px] font-semibold text-norma-text leading-none">Norma</h1>
            <p className="text-[9px] text-norma-textMuted font-mono mt-0.5">Agent Core · Ready</p>
          </div>
        </div>
        <WindowControls />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3 min-h-0"
      >
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-norma-accentMuted flex items-center justify-center">
                <Bot className="w-6 h-6 text-norma-accent" />
              </div>
              <h2 className="text-sm font-semibold text-norma-text mb-1">Welcome to Norma</h2>
              <p className="text-[11px] text-norma-textMuted max-w-[240px]">
                Your local intelligent agent. Ask me anything.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} index={idx} />
        ))}
      </div>

      <div className="flex-none px-5 pb-3 pt-1">
        <InputPill
          value={input}
          onChange={onInputChange}
          onSend={onSend}
          isStreaming={isStreaming}
        />
        <div className="text-center mt-2">
          <p className="text-[9px] text-norma-textDim flex justify-center items-center gap-1 font-mono tracking-wider">
            <span>Press</span>
            <kbd className="bg-white/5 px-1 py-px rounded border border-norma-hairline text-[8px]">Ctrl</kbd>
            <span>+</span>
            <kbd className="bg-white/5 px-1 py-px rounded border border-norma-hairline text-[8px]">Space</kbd>
            <span>for Command Bar</span>
          </p>
        </div>
      </div>
    </div>
  );
};
