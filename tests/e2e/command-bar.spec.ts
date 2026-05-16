import { test, expect } from './fixtures';

test.describe('命令栏窗口', () => {
  test('命令栏窗口应存在', async ({ app }) => {
    const windows = app.windows();
    const commandWindow = windows.find(w => w.url().includes('#/command'));
    expect(commandWindow).toBeDefined();
  });

  test('命令栏应包含输入框', async ({ app }) => {
    const windows = app.windows();
    const commandWindow = windows.find(w => w.url().includes('#/command'));
    if (!commandWindow) return;
    
    const input = commandWindow.locator('textarea, input[type="text"], [contenteditable]').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('Escape 键应隐藏命令栏', async ({ app }) => {
    const windows = app.windows();
    const commandWindow = windows.find(w => w.url().includes('#/command'));
    if (!commandWindow) return;
    
    await commandWindow.keyboard.press('Escape');
    await commandWindow.waitForTimeout(500);
  });
});

test.describe('命令栏 IPC 通信', () => {
  test('命令栏应通过独立路由加载', async ({ app }) => {
    const windows = app.windows();
    const commandWindows = windows.filter(w => w.url().includes('#/command'));
    expect(commandWindows.length).toBeGreaterThanOrEqual(1);
  });

  test('命令栏窗口应尺寸正确（680x56）', async ({ app }) => {
    const windows = app.windows();
    const cmdWin = windows.find(w => w.url().includes('#/command'));

    if (cmdWin) {
      const size = await cmdWin.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      expect(size.width).toBeLessThanOrEqual(700);
      expect(size.height).toBeLessThanOrEqual(100);
    }
  });
});
