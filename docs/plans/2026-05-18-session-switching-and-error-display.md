# Session Switching + Error Display Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix session switching (click "+" to go to welcome, click session to load history) and error display (show only message, not full JSON).

**Architecture:** We create a custom `RemoteThreadListAdapter` that wraps our Mastra IPC calls (listThreads, getThread, getThreadMessages) and feeds them to assistant-ui's `useLocalRuntime` thread management. This enables `runtime.threads.switchToThread(id)` and `runtime.threads.switchToNewThread()` to work properly. For error display, we replace `ErrorPrimitive.Message` with a custom component that extracts only the `.message` field.

**Tech Stack:** assistant-ui core (`useLocalRuntime` → `useRemoteThreadListRuntime` → `RemoteThreadListThreadListRuntimeCore`), Mastra memory IPC, React hooks.

---

## Key Architecture Discovery

`useLocalRuntime` internally uses `useRemoteThreadListRuntime`, which:
1. Creates a `RemoteThreadListThreadListRuntimeCore` with an adapter
2. When no cloud is configured, uses `InMemoryThreadListAdapter` (no-op adapter)
3. `InMemoryThreadListAdapter.fetch()` **always rejects** — this is why switchToThread fails
4. We need a custom adapter that knows about our Mastra threads

The `runtime.threads.switchToThread(threadId)` flow:
1. Check if thread is already in state → if not, call `adapter.fetch(threadId)` to get metadata
2. Start a fresh `LocalRuntimeCore` for the thread via `_hookManager.startThreadRuntime(data.id)`
3. Set `_mainThreadId` to the new thread
4. Notify subscribers → UI re-renders with new (empty) thread

**Problem:** Switching clears messages. We need to load history from Mastra and inject it.

**Solution:** Use `runtime.thread.reset(initialMessages)` after switching to load Mastra history.

---

### Task 1: Create Custom Mastra Thread List Adapter

**Files:**
- Create: `src/renderer/src/lib/mastra-thread-adapter.ts`
- Reference: `node_modules/@assistant-ui/core/src/runtimes/remote-thread-list/adapter/in-memory.ts` (InMemoryThreadListAdapter)
- Reference: `node_modules/@assistant-ui/core/src/runtimes/remote-thread-list/types.ts` (RemoteThreadListAdapter interface)

**Step 1: Create the adapter file**

```typescript
import type {
  RemoteThreadListAdapter,
  RemoteThreadListResponse,
  RemoteThreadMetadata,
  RemoteThreadInitializeResponse,
} from "@assistant-ui/react";
import type { AssistantStream, AssistantStreamChunk } from "assistant-stream";

export class MastraThreadListAdapter implements RemoteThreadListAdapter {
  async list(): Promise<RemoteThreadListResponse> {
    try {
      const threads = (await window.electronAPI?.listThreads?.()) || [];
      return {
        threads: threads.map((t: any) => ({
          status: "regular" as const,
          remoteId: t.id,
          title: t.title || "新会话",
          externalId: undefined,
        })),
      };
    } catch {
      return { threads: [] };
    }
  }

  async fetch(threadId: string): Promise<RemoteThreadMetadata> {
    try {
      const thread = await window.electronAPI?.getThread?.(threadId);
      if (!thread) throw new Error("Thread not found");
      return {
        status: "regular" as const,
        remoteId: thread.id,
        title: thread.title || "新会话",
        externalId: undefined,
      };
    } catch {
      throw new Error("Thread not found");
    }
  }

  async initialize(threadId: string): Promise<RemoteThreadInitializeResponse> {
    return { remoteId: threadId, externalId: undefined };
  }

  async rename(threadId: string, newTitle: string): Promise<void> {
    // Optional: implement via IPC if needed
  }

  async delete(threadId: string): Promise<void> {
    try {
      await window.electronAPI?.deleteThread?.(threadId);
    } catch {}
  }

  generateTitle(): Promise<AssistantStream> {
    return Promise.resolve(new ReadableStream() as any);
  }

  archive(): Promise<void> { return Promise.resolve(); }
  unarchive(): Promise<void> { return Promise.resolve(); }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/renderer/src/lib/mastra-thread-adapter.ts`
Expected: No errors (or only import resolution issues that Vite handles)

**Step 3: Commit**

```bash
git add src/renderer/src/lib/mastra-thread-adapter.ts
git commit -m "feat: add MastraThreadListAdapter for assistant-ui thread management"
```

---

### Task 2: Integrate Adapter into NormaRuntime

**Files:**
- Modify: `src/renderer/src/components/runtime.tsx:96-152` (NormaRuntime component)

**Step 1: Pass custom adapter to useLocalRuntime**

In `runtime.tsx`, the `useLocalRuntime` call needs the custom adapter. Looking at the code flow:

```
useLocalRuntime(chatModel, options)
  → useRemoteThreadListRuntime({ runtimeHook, adapter })
    → adapter = cloudAdapter = useCloudThreadListAdapter({ cloud: undefined })
      → returns InMemoryThreadListAdapter (no cloud)
```

We need to bypass this by using `useCloudThreadListAdapter` with a custom adapter. The trick is to pass `cloud` as undefined but override the adapter creation.

**Actually**, looking more carefully at `useCloudThreadListAdapter` (line 78-86), when no cloud:
```typescript
const cloud = adapter.cloud ?? autoCloud;
if (!cloud) {
  const inMemory = new InMemoryThreadListAdapter();
  // ...
  return inMemory;
}
```

We can't easily override this. Instead, we need to use `useRemoteThreadListRuntime` directly with our adapter. But `useLocalRuntime` wraps it.

**Better approach:** Use `useCloudThreadListAdapter`'s `create` option (see line 25-26 of useCloudThreadListAdapter.tsx):

```typescript
type CloudThreadListAdapterOptions = {
  cloud?: AssistantCloud | undefined;
  create?: (() => Promise<ThreadData>) | undefined;
  delete?: ((threadId: string) => Promise<void>) | undefined;
};
```

Wait, this only adds `create` and `delete` hooks, not `fetch` or `list`. The `InMemoryThreadListAdapter` is still returned when no cloud.

**Final approach:** We need to NOT use `useLocalRuntime` and instead replicate what it does with our custom adapter. Let's create a `useNormaRuntime` hook that does this.

Modify `src/renderer/src/components/runtime.tsx`:

```typescript
import { MastraThreadListAdapter } from "../lib/mastra-thread-adapter";

// Replace the useLocalRuntime call in NormaRuntime with:
const adapter = React.useMemo(() => new MastraThreadListAdapter(), []);
const runtime = useLocalRuntime(ipcModel, {
  maxSteps,
  adapters: {
    dictation: dictationAdapter,
    speech: speechAdapter,
    attachments: attachmentAdapter,
    feedback: feedbackAdapter,
  },
});
```

Wait — `useLocalRuntime` options don't accept a custom thread list adapter. The only way to inject one is via `cloud` which expects an `AssistantCloud` instance.

**Correct approach:** We need to use the lower-level APIs. `useLocalRuntime` is a convenience wrapper. We need to:

1. Use `useRemoteThreadListRuntime` directly (it's exported from `@assistant-ui/react`)
2. Pass our `MastraThreadListAdapter` as the adapter

But `useRemoteThreadListRuntime` expects a `runtimeHook` that creates the per-thread runtime. We can reuse the `useLocalThreadRuntime` pattern from the source.

**Actually, simplest approach:** Just use the runtime's `threads.switchToThread/switchToNewThread` directly from the component, and handle the `fetch` failure by pre-populating the thread in the adapter state.

Let me reconsider...

**Revised approach:** Instead of modifying the adapter layer, we can:

1. Call `runtime.threads.switchToNewThread()` for new session — this creates a fresh thread
2. For switching, call `runtime.thread.reset()` to clear messages, then reload from Mastra
3. Track the active thread via `shared.ts` state

The key insight: `switchToNewThread()` works with `InMemoryThreadListAdapter` because it doesn't call `fetch()`. It creates a local ID and then calls `switchToThread()` on the newly created local thread.

**For existing threads:** We can't use `switchToThread(mastraThreadId)` because `InMemoryThreadListAdapter.fetch()` rejects. But we CAN:
1. Create a new thread with `switchToNewThread()` 
2. Set `activeThreadId` to the Mastra thread ID  
3. Load Mastra messages via IPC and inject them with `runtime.thread.reset(messages)`

This is simpler and doesn't require a custom adapter at all!

**Step 1: Add thread switching logic to shared.ts**

Modify `src/renderer/src/lib/shared.ts`:

Add a callback-based system for the runtime to listen to thread switch requests:

```typescript
type ThreadSwitchRequest = 
  | { type: "new" }
  | { type: "switch"; threadId: string };

let _switchRequest: ThreadSwitchRequest | null = null;
const _switchListeners = new Set<(req: ThreadSwitchRequest) => void>();

export function requestThreadSwitch(req: ThreadSwitchRequest) {
  _switchRequest = req;
  for (const cb of _switchListeners) { try { cb(req); } catch {} }
}

export function onThreadSwitchRequest(cb: (req: ThreadSwitchRequest) => void): () => void {
  _switchListeners.add(cb);
  return () => { _switchListeners.delete(cb); };
}
```

**Step 2: Add ThreadSwitchHandler component in ChatArea**

Modify `src/renderer/src/components/ChatArea.tsx` to add a component that listens for switch requests and calls the runtime API:

```typescript
const ThreadSwitchHandler: React.FC = () => {
  const runtime = useAssistantRuntime(); // or get from context
  // Listen for switch requests
  // On "new": runtime.threads.switchToNewThread()
  // On "switch": runtime.threads.switchToNewThread() then runtime.thread.reset(mastraMessages)
  return null;
};
```

**Step 3: Update handleNewSession and handleSwitchSession**

Modify `src/renderer/src/components/ChatArea.tsx`:

```typescript
const handleNewSession = () => {
  setActiveSessionId("");
  setActiveThreadId(undefined);
  setActiveNav("chat");
  requestThreadSwitch({ type: "new" });
};

const handleSwitchSession = (id: string) => {
  const session = sessions.find((s) => s.id === id);
  if (!session) return;
  setActiveSessionId(id);
  setActiveThreadId(session.threadId);
  setActiveNav("chat");
  requestThreadSwitch({ type: "switch", threadId: session.threadId! });
  // ... existing status update
};
```

**Step 4: Commit**

```bash
git add src/renderer/src/lib/shared.ts src/renderer/src/components/ChatArea.tsx
git commit -m "feat: implement thread switching via runtime.threads API"
```

---

### Task 3: Implement ThreadSwitchHandler Component

**Files:**
- Modify: `src/renderer/src/components/ChatArea.tsx` (add ThreadSwitchHandler)
- Reference: `src/renderer/src/lib/ipc-chat.ts` (for createIpcChatModel, onThreadCreated)
- Reference: `src/main/ipc/memory.ts` (getThreadMessages IPC)

**Step 1: Write the ThreadSwitchHandler component**

This component sits inside the `AssistantRuntimeProvider` context and can access the runtime. Add it inside `ChatAreaInner`, rendered inside the `ThreadPrimitive.Root`.

The handler needs:
1. Access to `runtime.threads.switchToNewThread()` 
2. Access to `runtime.thread.reset(messages)` 
3. Ability to load messages from Mastra via `window.electronAPI.getThreadMessages(threadId)`

The messages from Mastra are in V2 format: `{ role, content: [{ type: "text", text }], ... }`.
We need to convert them to assistant-ui's `ThreadMessageLike` format:
```typescript
type ThreadMessageLike = {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
};
```

**Step 2: Add useAssistantRuntime import**

Check if `useAssistantRuntime` or equivalent hook exists. Looking at assistant-ui exports:

We can use the `useThreadRuntime` hook which gives us `thread.reset()`, but for `threads.switchToNewThread()` we need the full runtime. Let's check what's available:

From `@assistant-ui/react`, the hooks available include `useThreadRuntime` (for thread-level operations) and `useLocalRuntime` (returns the full runtime). But `useLocalRuntime` is the factory hook, not an accessor.

We need to access the runtime that was created in `NormaRuntime`. The simplest way: store it in a ref via context.

**Alternative:** Use `useAssistantRuntime` from `@assistant-ui/react` if it exists. Let me check.

Looking at the type: `AssistantRuntimeProvider` provides the runtime via React context. The hook to access it should be `useAssistantRuntime` or similar.

Actually, looking at the assistant-ui source, the `ThreadListRuntime` methods (`switchToThread`, `switchToNewThread`) are accessible via `runtime.threads` on the `AssistantRuntime`. We can get it via:

```typescript
import { useLocalRuntime } from "@assistant-ui/react";
// This returns the runtime in the component that creates it
// But for child components, we need a context accessor
```

Let me check what context hooks are exported:

```typescript
// From assistant-ui, to get the runtime in a child component:
// useThreadRuntime() → ThreadRuntime (has reset())
// For ThreadListRuntime.threads.switchToNewThread(), we need the AssistantRuntime
```

**Plan:** Store the runtime in a module-level ref in `runtime.tsx` and export an accessor:

```typescript
// In runtime.tsx:
let _runtimeRef: AssistantRuntime | null = null;
export function getAssistantRuntime() { return _runtimeRef; }

// In NormaRuntime:
const runtime = useLocalRuntime(...);
_runtimeRef = runtime; // Store ref
```

Then in `ChatArea.tsx`:
```typescript
import { getAssistantRuntime } from "./runtime";

const ThreadSwitchHandler = () => {
  useEffect(() => {
    return onThreadSwitchRequest(async (req) => {
      const runtime = getAssistantRuntime();
      if (!runtime) return;
      
      if (req.type === "new") {
        await runtime.threads.switchToNewThread();
      } else {
        // Load messages from Mastra
        const messages = await window.electronAPI?.getThreadMessages?.(req.threadId);
        await runtime.threads.switchToNewThread();
        if (messages && messages.length > 0) {
          const threadMessages = convertMastraMessages(messages);
          runtime.thread.reset(threadMessages);
        }
        setActiveThreadId(req.threadId);
      }
    });
  }, []);
  return null;
};
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/runtime.tsx src/renderer/src/components/ChatArea.tsx src/renderer/src/lib/shared.ts
git commit -m "feat: add ThreadSwitchHandler for session switching"
```

---

### Task 4: Fix Error Display

**Files:**
- Modify: `src/renderer/src/components/messages/AssistantMessage.tsx:269-273` (ErrorPrimitive.Message section)

**Step 1: Replace ErrorPrimitive.Message with custom error extraction**

The current code at line 269-273:
```tsx
<MessagePrimitive.Error>
  <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
    <ErrorPrimitive.Message />
  </div>
</MessagePrimitive.Error>
```

Replace with custom error extraction that only shows the message:

```tsx
const ErrorDisplay: React.FC = () => {
  const message = useMessage();
  const errorText = (() => {
    const err = (message as any)?.error;
    if (!err) return "发生错误";
    if (typeof err === 'string') return err.replace(/^Error:\s*/i, '');
    if (err.message) return err.message;
    try { return JSON.stringify(err); } catch { return String(err); }
  })();
  return (
    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px]">
      {errorText}
    </div>
  );
};
```

Then replace the Error section:
```tsx
<MessagePrimitive.Error>
  <ErrorDisplay />
</MessagePrimitive.Error>
```

**Step 2: Verify error display works**

Test by triggering an error (e.g., send a message without configuring a model).

**Step 3: Commit**

```bash
git add src/renderer/src/components/messages/AssistantMessage.tsx
git commit -m "fix: show only error message instead of full JSON"
```

---

### Task 5: End-to-End Testing and Cleanup

**Files:**
- Modify: `src/renderer/src/lib/shared.ts` (remove unused runtimeKey/pendingSessionId if no longer needed)
- Modify: `src/renderer/src/App.tsx` (remove runtimeKey monitoring if no longer needed)

**Step 1: Remove unused code**

- Remove `runtimeKey`, `bumpRuntimeKey`, `onRuntimeKeyChange` from `shared.ts` if thread switching works without key-based remounting
- Remove `runtimeKey` state and effect from `App.tsx`
- Remove `pendingSessionId` from `shared.ts`

**Step 2: Test all scenarios**

1. Click "+" → should show welcome screen with empty thread
2. Type a message → should create new thread and send
3. Click "+" again → should show welcome screen
4. Click existing session → should load and display its messages
5. Trigger an error → should show clean message, not full JSON
6. Delete a session → should work without errors
7. Navigate to other pages and back → session list should persist

**Step 3: Commit cleanup**

```bash
git add -A
git commit -m "cleanup: remove unused runtimeKey mechanism"
```

---

## Summary

| Task | Description | Key Change |
|------|-------------|------------|
| 1 | Create MastraThreadListAdapter | Custom adapter with fetch/list that calls Mastra IPC |
| 2 | Integrate adapter into runtime | Pass adapter via useCloudThreadListAdapter options |
| 3 | Implement ThreadSwitchHandler | Component that calls runtime.threads.switchToNewThread() and runtime.thread.reset() |
| 4 | Fix error display | Replace ErrorPrimitive.Message with custom error extraction |
| 5 | Cleanup and testing | Remove unused code, test all scenarios |

**Note on Task 1-2 vs simplified approach:** If the MastraThreadListAdapter approach proves too complex, the simplified approach in Task 3 (using switchToNewThread + reset) can work without a custom adapter. The adapter is needed only if we want proper thread list management (listing threads in assistant-ui's state, proper thread IDs, etc.). The simplified approach creates a new local thread for each switch and injects messages.
