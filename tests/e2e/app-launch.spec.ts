import { test, expect } from './fixtures';

test.describe('应用启动', () => {
  test('应创建主窗口并加载 React 界面', async ({ app, mainWindow }) => {
    const windows = app.windows();
    expect(windows.length).toBeGreaterThanOrEqual(2);

    const title = await mainWindow.title();
    expect(title).toBeDefined();

    const url = mainWindow.url();
    expect(url).toContain('index.html');
    expect(url).not.toContain('#/command');
  });

  test('主窗口应显示欢迎界面（无会话时）', async ({ mainWindow }) => {
    const welcome = mainWindow.locator('text=欢迎使用 Norma');
    await expect(welcome).toBeVisible({ timeout: 15000 });
  });

  test('主窗口应包含左侧导航栏', async ({ mainWindow }) => {
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 10000 });
    await expect(mainWindow.locator('.nav-item:has-text("对话")')).toBeVisible();
    await expect(mainWindow.locator('.nav-item:has-text("能力")')).toBeVisible();
    await expect(mainWindow.locator('.nav-item:has-text("自动化")')).toBeVisible();
    await expect(mainWindow.locator('.nav-item:has-text("知识库")')).toBeVisible();
    await expect(mainWindow.locator('.nav-item:has-text("设置")')).toBeVisible();
  });

  test('主窗口应显示窗口控制按钮', async ({ mainWindow }) => {
    const controls = mainWindow.locator('[class*="lucide-minus"], [class*="lucide-x"]');
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('isPackaged 在开发模式下应为 false', async ({ app }) => {
    const isPackaged = await app.evaluate(async ({ app }) => {
      return app.isPackaged;
    });
    expect(isPackaged).toBe(false);
  });
});
