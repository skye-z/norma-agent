import { ipcMain } from 'electron';
import { getMemory } from '../agent';

const RESOURCE_ID = 'norma-user';

export function setupMemoryIpc() {
  ipcMain.handle('memory:createThread', async (_event, title?: string) => {
    const memory = getMemory();
    if (!memory) throw new Error('Memory not initialized');
    const thread = await memory.createThread({
      resourceId: RESOURCE_ID,
      title: title || '新会话',
    });
    return { id: thread.id, title: thread.title, resourceId: thread.resourceId, createdAt: thread.createdAt, updatedAt: thread.updatedAt };
  });

  ipcMain.handle('memory:listThreads', async () => {
    const memory = getMemory();
    if (!memory) throw new Error('Memory not initialized');
    const result = await memory.listThreads({
      filter: { resourceId: RESOURCE_ID },
      perPage: false,
    });
    return result.threads.map((t) => ({
      id: t.id,
      title: t.title,
      resourceId: t.resourceId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  });

  ipcMain.handle('memory:getThread', async (_event, threadId: string) => {
    const memory = getMemory();
    if (!memory) throw new Error('Memory not initialized');
    const thread = await memory.getThreadById({ threadId });
    if (!thread) return null;
    return { id: thread.id, title: thread.title, resourceId: thread.resourceId, createdAt: thread.createdAt, updatedAt: thread.updatedAt };
  });

  ipcMain.handle('memory:deleteThread', async (_event, threadId: string) => {
    const memory = getMemory();
    if (!memory) throw new Error('Memory not initialized');
    await memory.deleteThread(threadId);
    return true;
  });

  ipcMain.handle('memory:getThreadMessages', async (_event, threadId: string) => {
    const memory = getMemory();
    if (!memory) throw new Error('Memory not initialized');
    const { messages } = await memory.recall({ threadId, perPage: 100 });
    return messages;
  });
}
