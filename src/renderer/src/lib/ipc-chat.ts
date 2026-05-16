type ContentPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string };

interface YieldContent {
  content: ContentPart[];
}

type QueueItem =
  | { type: "chunk"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export function createIpcChatModel() {
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

      interface UnsubscribeFn {
        (): void;
      }

      const unsubscribeChunk: UnsubscribeFn = window.electronAPI.onMessage(
        "chat:chunk",
        (chunk: string) => {
          pushToQueue({ type: "chunk", text: chunk });
        },
      );

      const unsubscribeDone: UnsubscribeFn = window.electronAPI.onMessage(
        "chat:done",
        () => {
          pushToQueue({ type: "done" });
        },
      );

      const unsubscribeError: UnsubscribeFn = window.electronAPI.onMessage(
        "chat:error",
        (err: string) => {
          pushToQueue({ type: "error", message: err });
        },
      );

      window.electronAPI.sendMessage("chat:send", text);

      let fullText = "";
      let isFirstChunk = true;

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
            yield {
              content: [{ type: "text", text: `错误: ${item.message}` }],
            };
            break;
          }

          fullText += item.text;

          if (isFirstChunk) {
            isFirstChunk = false;
            yield {
              content: [
                { type: "reasoning", text: "Norma 正在处理..." },
                { type: "text", text: fullText },
              ],
            };
          } else {
            yield {
              content: [{ type: "text", text: fullText }],
            };
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
