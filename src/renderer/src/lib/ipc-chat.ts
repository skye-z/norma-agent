type ContentPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown>; argsText: string; result?: unknown; isError?: boolean };

interface YieldContent {
  content: ContentPart[];
}

type StreamChunk =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: "usage"; usage: { promptTokens: number; completionTokens: number; totalTokens?: number; cachedTokens?: number } };

type QueueItem =
  | { type: "chunk"; chunk: StreamChunk }
  | { type: "done" }
  | { type: "error"; message: string };

export interface UsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  cachedTokens?: number;
}

export let lastUsage: UsageData = { promptTokens: 0, completionTokens: 0 };

const usageListeners = new Set<(usage: UsageData) => void>();

export function onUsageUpdate(cb: (usage: UsageData) => void): () => void {
  usageListeners.add(cb);
  return () => { usageListeners.delete(cb); };
}

function notifyUsage(usage: UsageData) {
  lastUsage = usage;
  for (const cb of usageListeners) {
    try { cb(usage); } catch {}
  }
}

export function createIpcChatModel(getThreadId?: () => string | undefined) {
  return {
    async *run({
      messages,
      abortSignal,
    }: {
      messages: any[];
      abortSignal: AbortSignal;
    }): AsyncGenerator<YieldContent> {
      const last = messages[messages.length - 1];
      const text =
        typeof last.content === "string"
          ? last.content
          : last.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join("");

      if (!window.electronAPI) {
        yield {
          content: [
            {
              type: "text",
              text: "未检测到 Electron 环境，请在 Norma 桌面应用中运行。",
            },
          ],
        };
        return;
      }

      const queue: QueueItem[] = [];
      let resolveNext: ((item: QueueItem) => void) | null = null;

      const pushToQueue = (item: QueueItem) => {
        if (resolveNext) {
          resolveNext(item);
          resolveNext = null;
        } else {
          queue.push(item);
        }
      };

      const unsubscribeChunk = window.electronAPI.onChatChunk(
        (raw: string) => {
          try {
            const chunk: StreamChunk = JSON.parse(raw);
            pushToQueue({ type: "chunk", chunk });
          } catch {
            pushToQueue({ type: "chunk", chunk: { type: "text-delta", text: raw } });
          }
        },
      );

      const unsubscribeDone = window.electronAPI.onChatDone(
        () => {
          pushToQueue({ type: "done" });
        },
      );

      const unsubscribeError = window.electronAPI.onChatError(
        (err: string) => {
          pushToQueue({ type: "error", message: err });
        },
      );

      const threadId = getThreadId?.();
      window.electronAPI.chatSend(threadId ? { message: text, threadId } : text);

      if (abortSignal) {
        const onAbort = () => {
          (window as any).electronAPI?.cancelChat?.();
          pushToQueue({ type: "done" });
        };
        abortSignal.addEventListener("abort", onAbort);
      }

      let fullText = "";
      let flushedTextLen = 0;
      const contentParts: ContentPart[] = [];

      const flushText = () => {
        if (fullText.length > flushedTextLen) {
          const newText = fullText.slice(flushedTextLen);
          flushedTextLen = fullText.length;
          return newText;
        }
        return null;
      };

      let yieldScheduled = false;
      const scheduleYield = () => {
        if (yieldScheduled) return;
        yieldScheduled = true;
        Promise.resolve().then(() => {
          yieldScheduled = false;
        });
      };

      try {
        while (true) {
          if (abortSignal?.aborted) {
            break;
          }

          let item: QueueItem;
          if (queue.length > 0) {
            item = queue.shift()!;
          } else {
            item = await new Promise<QueueItem>((resolve) => {
              resolveNext = resolve;
            });
          }

          if (item.type === "done") {
            break;
          }

          if (item.type === "error") {
            throw new Error(item.message);
          }

          const { chunk } = item;

          if (chunk.type === "text-delta") {
            fullText += chunk.text;
          } else if (chunk.type === "tool-call") {
            flushedTextLen = fullText.length;
            contentParts.push({
              type: "tool-call",
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              args: chunk.args,
              argsText: JSON.stringify(chunk.args),
            });
          } else if (chunk.type === "tool-result") {
            flushedTextLen = fullText.length;
            const existing = contentParts.find(
              (p) => p.type === "tool-call" && p.toolCallId === chunk.toolCallId,
            );
            if (existing && existing.type === "tool-call") {
              (existing as any).result = chunk.result;
              (existing as any).isError = chunk.isError;
            } else {
              contentParts.push({
                type: "tool-call",
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: {},
                argsText: "{}",
                result: chunk.result,
                isError: chunk.isError,
              });
            }
          } else if (chunk.type === "usage") {
            notifyUsage(chunk.usage);
          }

          const content: ContentPart[] = [...contentParts];
          if (fullText) {
            content.push({ type: "text", text: fullText });
          }
          if (content.length > 0) {
            yield { content };
          }
        }
      } finally {
        unsubscribeChunk();
        unsubscribeDone();
        unsubscribeError();
      }
    },
  };
}
