import { useState, useEffect } from 'react';

let messageQueue: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function useMessageQueue() {
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    const listener = () => setQueue([...messageQueue]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const enqueue = (msg: string) => {
    if (!msg.trim()) return;
    messageQueue.push(msg);
    notify();
  };

  const dequeue = (index: number): string | null => {
    if (index < 0 || index >= messageQueue.length) return null;
    const msg = messageQueue[index];
    messageQueue.splice(index, 1);
    notify();
    return msg;
  };

  const dequeueFirst = (): string | null => {
    if (messageQueue.length === 0) return null;
    const msg = messageQueue.shift()!;
    notify();
    return msg;
  };

  const clearQueue = () => {
    messageQueue = [];
    notify();
  };

  const updateAt = (index: number, newMsg: string) => {
    if (index >= 0 && index < messageQueue.length) {
      messageQueue[index] = newMsg;
      notify();
    }
  };

  const removeAt = (index: number) => {
    if (index >= 0 && index < messageQueue.length) {
      messageQueue.splice(index, 1);
      notify();
    }
  };

  return { queue, enqueue, dequeue, dequeueFirst, clearQueue, updateAt, removeAt };
}