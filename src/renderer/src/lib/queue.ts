import { useState, useEffect } from 'react';

// Global queue state
let messageQueue: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function useMessageQueue() {
  const [queue, setQueue] = useState(messageQueue);

  useEffect(() => {
    const listener = () => setQueue([...messageQueue]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const enqueue = (msg: string) => {
    messageQueue.push(msg);
    notify();
  };

  const dequeue = (index: number) => {
    const msg = messageQueue[index];
    messageQueue.splice(index, 1);
    notify();
    return msg;
  };

  const clearQueue = () => {
    messageQueue = [];
    notify();
  };

  return { queue, enqueue, dequeue, clearQueue };
}
