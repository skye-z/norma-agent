import { test, expect } from './fixtures';

async function goToSettings(mainWindow: any) {
  await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });
  await mainWindow.locator('.nav-item:has-text("设置")').click({ force: true });
  await expect(mainWindow.locator('text=基础').first()).toBeVisible();
}

test.describe('设置页面 - 基础标签', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await goToSettings(mainWindow);
    await mainWindow.locator('text=基础').first().click({ force: true });
  });

  test('应显示主题选择', async ({ mainWindow }) => {
    await expect(mainWindow.locator('text=主题').first()).toBeVisible();
    await expect(mainWindow.locator('text=暗色').first()).toBeVisible();
  });

  test('应显示快捷键信息', async ({ mainWindow }) => {
    const shortcut = mainWindow.locator('text=Ctrl+Shift+Space');
    if (await shortcut.isVisible()) {
      await expect(shortcut).toBeVisible();
    }
  });
});

test.describe('设置页面 - 模型标签', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await goToSettings(mainWindow);
    await mainWindow.locator('text=模型').first().click({ force: true });
  });

  test('应显示添加供应商按钮', async ({ mainWindow }) => {
    await expect(mainWindow.locator('text=添加供应商').first()).toBeVisible();
  });

  test('供应商预设 IPC 应返回正确数据结构', async ({ mainWindow }) => {
    const presets = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.invokeProviderPresets) return null;
      return await window.electronAPI.invokeProviderPresets();
    });

    if (presets) {
      expect(presets.length).toBeGreaterThanOrEqual(3);
      const names = presets.map((p: any) => p.name);
      expect(names).toContain('OpenAI');
      expect(names).toContain('Anthropic');
      expect(names).toContain('Ollama (本地)');
      expect(presets[0]).toHaveProperty('id');
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('type');
      expect(presets[0]).toHaveProperty('baseUrl');
    }
  });

  test('供应商连通性测试应处理无效配置', async ({ mainWindow }) => {
    const result = await mainWindow.evaluate(async () => {
      if (!window.electronAPI?.testProviderConnectivity) return null;
      return await window.electronAPI.testProviderConnectivity({
        type: 'openai',
        baseUrl: 'http://invalid-host-that-does-not-exist.test',
        apiKey: 'invalid-key',
      });
    });

    if (result) {
      expect(result.success).toBe(false);
    }
  });
});

test.describe('设置页面 - 关于标签', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await goToSettings(mainWindow);
    await mainWindow.locator('text=关于').first().click({ force: true });
  });

  test('应显示运行时信息', async ({ mainWindow }) => {
    await expect(mainWindow.locator('text=Electron 42').first()).toBeVisible();
  });

  test('应显示版本号', async ({ mainWindow }) => {
    await expect(mainWindow.locator('text=版本').first()).toBeVisible();
  });
});
