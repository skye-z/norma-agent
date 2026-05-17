import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MessageQueue (pure logic)', () => {
  let messageQueue: string[];
  let listeners: Set<() => void>;

  function notify() {
    listeners.forEach((l) => l());
  }

  function enqueue(msg: string) {
    messageQueue.push(msg);
    notify();
  }

  function dequeue(index: number) {
    const msg = messageQueue[index];
    messageQueue.splice(index, 1);
    notify();
    return msg;
  }

  function clearQueue() {
    messageQueue = [];
    notify();
  }

  beforeEach(() => {
    messageQueue = [];
    listeners = new Set();
  });

  it('should enqueue messages', () => {
    enqueue('hello');
    enqueue('world');
    expect(messageQueue).toEqual(['hello', 'world']);
  });

  it('should dequeue by index', () => {
    enqueue('a');
    enqueue('b');
    enqueue('c');
    const removed = dequeue(1);
    expect(removed).toBe('b');
    expect(messageQueue).toEqual(['a', 'c']);
  });

  it('should clear the queue', () => {
    enqueue('x');
    enqueue('y');
    clearQueue();
    expect(messageQueue).toEqual([]);
  });

  it('should notify listeners on enqueue', () => {
    const listener = vi.fn();
    listeners.add(listener);
    enqueue('test');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should notify listeners on dequeue', () => {
    enqueue('test');
    const listener = vi.fn();
    listeners.add(listener);
    dequeue(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should notify listeners on clear', () => {
    enqueue('test');
    const listener = vi.fn();
    listeners.add(listener);
    clearQueue();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should support multiple listeners', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    listeners.add(l1);
    listeners.add(l2);
    enqueue('msg');
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  it('should handle dequeue from empty queue gracefully', () => {
    const removed = dequeue(0);
    expect(removed).toBeUndefined();
    expect(messageQueue).toEqual([]);
  });
});
