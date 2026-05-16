import React from 'react';
import { useMessageQueue } from '../../lib/queue';
import { useThread, useThreadRuntime } from '@assistant-ui/react';

export const QueueDisplay: React.FC = () => {
  const { queue, dequeue } = useMessageQueue();
  const thread = useThread();
  const runtime = useThreadRuntime();

  if (queue.length === 0) return null;

  const handleSendNow = async (index: number) => {
    const msg = dequeue(index);
    if (thread.isRunning) {
      runtime.cancelRun();
      // wait a bit for it to cancel
      await new Promise(r => setTimeout(r, 300));
    }
    runtime.append({
      role: 'user',
      content: [{ type: 'text', text: msg }]
    });
  };

  return (
    <div className="flex flex-col gap-2 mb-2 w-full px-5">
      {queue.map((msg, idx) => (
        <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] group">
          <div className="w-1.5 h-1.5 rounded-full bg-norma-textDim animate-pulse flex-none" />
          <div className="flex-1 text-norma-textMuted truncate">
            排队中: {msg}
          </div>
          <button
            onClick={() => handleSendNow(idx)}
            className="opacity-0 group-hover:opacity-100 flex-none px-2 py-1 rounded bg-norma-accent/20 text-norma-accent hover:bg-norma-accent hover:text-white transition-all duration-200"
            title="打断当前回复并立即发送此消息"
          >
            立即发送
          </button>
        </div>
      ))}
    </div>
  );
};
