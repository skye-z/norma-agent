import React, { useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface InputPillProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  isStreaming: boolean;
}

export const InputPill: React.FC<InputPillProps> = ({
  value,
  onChange,
  onSend,
  isStreaming,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '20px';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="input-pill w-full max-w-[560px] mx-auto px-3 py-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Norma to do something..."
        rows={1}
        disabled={isStreaming}
        className="flex-1 bg-transparent text-[12px] text-norma-text placeholder-norma-textMuted
                   outline-none resize-none leading-relaxed min-h-[20px] max-h-[120px] py-px"
      />
      <button
        onClick={onSend}
        disabled={!value.trim() || isStreaming}
        className={`flex-none ml-1.5 p-1.5 rounded-full transition-all duration-150 ${
          value.trim() && !isStreaming
            ? 'bg-norma-accent text-white shadow-sm hover:opacity-90'
            : 'bg-white/5 text-norma-textDim cursor-not-allowed'
        }`}
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
