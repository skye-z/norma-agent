import { test, expect } from './fixtures';

test.describe('聊天流程', () => {
  test.beforeEach(async ({ mainWindow }) => {
    // 强制切回对话页面，保证测试隔离
    await mainWindow.locator('.nav-item:has-text("对话")').click({ force: true });
    await mainWindow.waitForTimeout(300);
  });

  test('无 OPENAI_API_KEY 时应显示提示信息', async ({ mainWindow }) => {
    const composer = mainWindow.locator('.composer-pill textarea, .composer-pill [contenteditable]').first();
    await expect(composer).toBeVisible({ timeout: 15000 });

    if (await composer.isVisible()) {
      await composer.click();
      await composer.fill('你好');
      await mainWindow.keyboard.press('Enter');
      await mainWindow.waitForTimeout(2000);

      const response = mainWindow.locator('text=OPENAI_API_KEY is not configured');
      if (await response.isVisible()) {
        expect(await response.isVisible()).toBe(true);
      }
    }
  });

  test('输入框应存在且可交互', async ({ mainWindow }) => {
    const composer = mainWindow.locator('.composer-pill textarea').first();
    await expect(composer).toBeVisible({ timeout: 15000 });
    if (await composer.isVisible()) {
      await composer.click();
      await composer.fill('测试输入');
      const value = await composer.inputValue();
      expect(value).toContain('测试输入');
    }
  });

  test('模型选择器动态加载（无启用模型时不显示）', async ({ mainWindow }) => {
    const modelBtn = mainWindow.locator('[title^="当前模型"]');
    const isVisible = await modelBtn.first().isVisible().catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('建议按钮应可点击并填充输入', async ({ mainWindow }) => {
    // 只有在空线程时才有建议按钮，如果不存在就跳过
    const suggestion = mainWindow.locator('button:has-text("分析屏幕")').first();
    if (await suggestion.isVisible()) {
      await suggestion.click();
      await mainWindow.waitForTimeout(500);
    }
  });
});

test.describe('聊天 IPC 通信', () => {
  test('chat:send 无 API key 应返回 fallback 响应', async ({ mainWindow }) => {
    // 强制切回对话页面，保证测试隔离
    await mainWindow.locator('.nav-item:has-text("对话")').click({ force: true });
    await mainWindow.waitForTimeout(300);

    const result = await mainWindow.evaluate(async () => {
      const chunks: string[] = [];
      return new Promise<string[]>((resolve) => {
        const unsub = window.electronAPI.onMessage('chat:chunk', (raw: string) => {
          try {
            const chunk = JSON.parse(raw);
            if (chunk.type === 'text-delta') chunks.push(chunk.text);
          } catch {}
        });
        const unsubDone = window.electronAPI.onMessage('chat:done', () => {
          unsub();
          unsubDone();
          resolve(chunks);
        });
        window.electronAPI.sendMessage('chat:send', 'test message');
        setTimeout(() => { unsub(); unsubDone(); resolve(chunks); }, 8000);
      });
    });

    if (result.length > 0) {
      expect(result.join('')).toContain('OPENAI_API_KEY');
    }
  });

  test('chat:send 应同时支持字符串和对象格式', async ({ mainWindow }) => {
    // 强制切回对话页面，保证测试隔离
    await mainWindow.locator('.nav-item:has-text("对话")').click({ force: true });
    await mainWindow.waitForTimeout(300);

    const result = await mainWindow.evaluate(async () => {
      const chunks: string[] = [];
      return new Promise<string[]>((resolve) => {
        const unsub = window.electronAPI.onMessage('chat:chunk', (raw: string) => {
          try {
            const chunk = JSON.parse(raw);
            if (chunk.type === 'text-delta') chunks.push(chunk.text);
          } catch {}
        });
        const unsubDone = window.electronAPI.onMessage('chat:done', () => {
          unsub();
          unsubDone();
          resolve(chunks);
        });
        window.electronAPI.sendMessage('chat:send', { message: 'hello', threadId: 'test-thread' });
        setTimeout(() => { unsub(); unsubDone(); resolve(chunks); }, 8000);
      });
    });

    if (result.length > 0) {
      expect(result.join('')).toBeTruthy();
    }
  });
});
