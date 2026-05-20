import React, { useState } from "react";
import { useThread, useThreadRuntime } from "@assistant-ui/react";
import { useMessageQueue } from "../../lib/queue";

export const QueueDisplay: React.FC = () => {
  const { queue, removeAt, updateAt } = useMessageQueue();
  const thread = useThread();
  const runtime = useThreadRuntime();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");

  if (queue.length === 0) return null;

  const handleSendNow = (index: number) => {
    const msg = queue[index];
    if (!msg) return;
    removeAt(index);
    runtime.append({
      role: "user",
      content: [{ type: "text", text: msg }],
    });
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditVal(queue[idx]);
  };

  const confirmEdit = () => {
    if (editingIdx !== null && editVal.trim()) {
      updateAt(editingIdx, editVal.trim());
      setEditingIdx(null);
      setEditVal("");
    }
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditVal("");
  };

  return (
    <div className="flex flex-col gap-1.5 mb-1 w-full">
      {queue.map((msg, idx) => (
        <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[13px] group">
          <div className="w-1.5 h-1.5 rounded-full bg-norma-textDim animate-pulse flex-none" />

          {editingIdx === idx ? (
            <>
              <input
                type="text"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") cancelEdit(); }}
                autoFocus
                className="flex-1 min-w-0 bg-white/[0.06] text-norma-text text-[13px] px-2 py-1 rounded outline-none border border-norma-accent/30 focus:border-norma-accent/60"
              />
              <button onClick={confirmEdit} className="flex-none p-1 rounded text-norma-accent hover:bg-norma-accent/20 transition-all duration-200" title="确认">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              </button>
              <button onClick={cancelEdit} className="flex-none p-1 rounded text-norma-textDim hover:bg-white/[0.06] transition-all duration-200" title="取消">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </>
          ) : (
            <>
              <div className="flex-1 text-norma-textMuted truncate">{msg}</div>
              <button
                onClick={() => handleSendNow(idx)}
                className="opacity-0 group-hover:opacity-100 flex-none px-2 py-0.5 rounded bg-norma-accent/20 text-norma-accent hover:bg-norma-accent hover:text-white transition-all duration-200 text-[12px]"
                title="打断并发送"
              >
                立即发送
              </button>
              <button onClick={() => startEdit(idx)} className="opacity-0 group-hover:opacity-100 flex-none p-1 rounded text-norma-textDim hover:text-norma-accent hover:bg-white/[0.06] transition-all duration-200" title="编辑">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
              </button>
              <button onClick={() => removeAt(idx)} className="opacity-0 group-hover:opacity-100 flex-none p-1 rounded text-norma-textDim hover:text-red-400 hover:bg-white/[0.06] transition-all duration-200" title="删除">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
