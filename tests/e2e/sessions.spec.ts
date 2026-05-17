import { test, expect } from './fixtures';

test.describe('会话管理', () => {
  test.beforeEach(async ({ mainWindow }) => {
    // 确保切回主界面
    await mainWindow.locator('.nav-item:has-text("对话")').click({ force: true });
    await mainWindow.waitForTimeout(300);
    await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });
  });

  test('初始状态应显示会话列表区域', async ({ mainWindow }) => {
    const sessionLabel = mainWindow.locator('text=会话历史');
    await expect(sessionLabel).toBeVisible();
  });

  test('点击 + 按钮应创建新会话', async ({ mainWindow }) => {
    const newBtn = mainWindow.locator('button:has(.lucide-plus)').first();
    await newBtn.click({ force: true });
    await mainWindow.waitForTimeout(1000);

    const sessionCards = mainWindow.locator('.session-card');
    const count = await sessionCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('创建多个会话后列表应更新', async ({ mainWindow }) => {
    const beforeCount = await mainWindow.locator('.session-card').count();
    const newBtn = mainWindow.locator('button:has(.lucide-plus)').first();

    await newBtn.click({ force: true });
    await mainWindow.waitForTimeout(500);
    await newBtn.click({ force: true });
    await mainWindow.waitForTimeout(500);

    const afterCount = await mainWindow.locator('.session-card').count();
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test('点击会话应切换为活跃状态', async ({ mainWindow }) => {
    const newBtn = mainWindow.locator('button:has(.lucide-plus)').first();
    await newBtn.click({ force: true });
    await mainWindow.waitForTimeout(300);
    await newBtn.click({ force: true });
    await mainWindow.waitForTimeout(300);

    const sessions = mainWindow.locator('.session-card');
    const count = await sessions.count();
    if (count >= 2) {
      await sessions.nth(0).click({ force: true });
      await expect(sessions.nth(0)).toHaveClass(/active/);
    }
  });

  test('删除会话应从列表移除', async ({ mainWindow }) => {
    const newBtn = mainWindow.locator('button:has(.lucide-plus)').first();
    await newBtn.click({ force: true });
    await mainWindow.waitForTimeout(300);

    const beforeCount = await mainWindow.locator('.session-card').count();
    const deleteBtn = mainWindow.locator('.session-card button[title="删除会话"]').first();
    // Use force: true because the button is only visible on hover
    await deleteBtn.click({ force: true });
    await mainWindow.waitForTimeout(300);
    const afterCount = await mainWindow.locator('.session-card').count();
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('删除所有会话后应回到空状态', async ({ mainWindow }) => {
    const deleteBtns = mainWindow.locator('.session-card button[title="删除会话"]');
    const count = await deleteBtns.count();
    for (let i = 0; i < Math.min(count, 20); i++) {
      const btn = mainWindow.locator('.session-card button[title="删除会话"]').first();
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click({ force: true });
      await mainWindow.waitForTimeout(300);
    }
    const remaining = await mainWindow.locator('.session-card').count();
    expect(remaining).toBeLessThanOrEqual(1);
  });
});
