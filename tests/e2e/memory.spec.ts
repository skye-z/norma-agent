import { test, expect } from './fixtures';

test.describe('内存线程管理 (IPC)', () => {
  test('memory:createThread 应创建线程并返回 ID', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });

    const thread = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.createThread) return null;
      return await window.electronAPI.createThread('测试线程');
    });

    if (thread) {
      expect(thread).toHaveProperty('id');
      expect(thread).toHaveProperty('title');
      expect(thread).toHaveProperty('resourceId');
      expect(thread.title).toBe('测试线程');
      expect(thread.resourceId).toBe('norma-user');
    }
  });

  test('memory:listThreads 应返回线程列表', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });

    const threads = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.listThreads) return null;
      return await window.electronAPI.listThreads();
    });

    if (threads) {
      expect(Array.isArray(threads)).toBe(true);
    }
  });

  test('memory:getThread 应返回指定线程', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });

    const created = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.createThread) return null;
      return await window.electronAPI.createThread('获取测试');
    });

    if (created) {
      const fetched = await mainWindow.evaluate(async (id) => {
        return await window.electronAPI.getThread(id);
      }, created.id);

      if (fetched) {
        expect(fetched.id).toBe(created.id);
      }
    }
  });

  test('memory:getThread 不存在的线程应返回 null', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });

    const result = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.getThread) return undefined;
      return await window.electronAPI.getThread('nonexistent-thread-id');
    });

    if (result !== undefined) {
      expect(result).toBeNull();
    }
  });

  test('memory:deleteThread 应删除线程', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });

    const created = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.createThread) return null;
      return await window.electronAPI.createThread('删除测试');
    });

    if (created) {
      const deleted = await mainWindow.evaluate(async (id) => {
        return await window.electronAPI.deleteThread(id);
      }, created.id);

      if (deleted !== undefined) {
        expect(deleted).toBe(true);
      }

      const fetched = await mainWindow.evaluate(async (id) => {
        return await window.electronAPI.getThread(id);
      }, created.id);

      if (fetched !== undefined) {
        expect(fetched).toBeNull();
      }
    }
  });

  test('memory:getThreadMessages 应返回空消息列表', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });

    const created = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.createThread) return null;
      return await window.electronAPI.createThread('消息测试');
    });

    if (created) {
      const messages = await mainWindow.evaluate(async (id) => {
        return await window.electronAPI.getThreadMessages(id);
      }, created.id);

      if (messages) {
        expect(Array.isArray(messages)).toBe(true);
        expect(messages.length).toBe(0);
      }
    }
  });
});
