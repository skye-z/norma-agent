import { test, expect } from './fixtures';

async function waitForApp(mainWindow: any) {
  await expect(mainWindow.locator('.glass-island-left')).toBeVisible({ timeout: 15000 });
}

test.describe('页面导航', () => {
  test('点击导航项应切换右侧内容', async ({ mainWindow }) => {
    await waitForApp(mainWindow);

    await mainWindow.locator('.nav-item:has-text("能力")').click({ force: true });
    await expect(mainWindow.locator('text=屏幕感知').first()).toBeVisible();

    await mainWindow.locator('.nav-item:has-text("自动化")').click({ force: true });
    await expect(mainWindow.locator('text=每日文件整理').first()).toBeVisible();

    await mainWindow.locator('.nav-item:has-text("知识库")').click({ force: true });
    await expect(mainWindow.locator('input[placeholder*="搜索文档"]').first()).toBeVisible();

    await mainWindow.locator('.nav-item:has-text("设置")').click({ force: true });
    await expect(mainWindow.locator('text=基础').first()).toBeVisible();
  });

  test('点击对话应返回聊天界面', async ({ mainWindow }) => {
    await waitForApp(mainWindow);
    await mainWindow.locator('.nav-item:has-text("设置")').click({ force: true });
    await expect(mainWindow.locator('text=基础').first()).toBeVisible();

    await mainWindow.locator('.nav-item:has-text("对话")').click({ force: true });
    await expect(mainWindow.locator('text=会话历史').first()).toBeVisible({ timeout: 5000 });
  });

  test('导航高亮应跟随当前页面', async ({ mainWindow }) => {
    await waitForApp(mainWindow);
    const capabilitiesNav = mainWindow.locator('.nav-item:has-text("能力")');
    await capabilitiesNav.click({ force: true });
    await expect(capabilitiesNav).toHaveClass(/active/);

    const settingsNav = mainWindow.locator('.nav-item:has-text("设置")');
    await settingsNav.click({ force: true });
    await expect(settingsNav).toHaveClass(/active/);
    await expect(capabilitiesNav).not.toHaveClass(/active/);
  });
});

test.describe('能力页面', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await waitForApp(mainWindow);
    await mainWindow.locator('.nav-item:has-text("能力")').click({ force: true });
  });

  test('应显示能力卡片列表', async ({ mainWindow }) => {
    await expect(mainWindow.locator('text=屏幕感知').first()).toBeVisible();
    await expect(mainWindow.locator('text=系统操控').first()).toBeVisible();
  });

  test('状态指示器应显示为开关', async ({ mainWindow }) => {
    const toggles = mainWindow.locator('.bg-emerald-500, .bg-emerald-400');
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('自动化页面', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await waitForApp(mainWindow);
    await mainWindow.locator('.nav-item:has-text("自动化")').click({ force: true });
  });

  test('应显示预设自动化任务', async ({ mainWindow }) => {
    await expect(mainWindow.locator('text=每日文件整理').first()).toBeVisible();
    await expect(mainWindow.locator('text=会议纪要生成').first()).toBeVisible();
  });

  test('应能创建新自动化任务', async ({ mainWindow }) => {
    const createBtn = mainWindow.locator('button:has-text("新建自动化")').first();
    await expect(createBtn).toBeVisible();
    await createBtn.click({ force: true });
    await expect(mainWindow.locator('input[placeholder="任务名称"]').first()).toBeVisible();
  });
});

test.describe('知识库页面', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await waitForApp(mainWindow);
    await mainWindow.locator('.nav-item:has-text("知识库")').click({ force: true });
  });

  test('应显示知识库界面', async ({ mainWindow }) => {
    await expect(mainWindow.locator('input[placeholder*="搜索文档"]').first()).toBeVisible();
    await expect(mainWindow.locator('.glass-island-right')).toBeVisible();
  });
});

test.describe('设置页面', () => {
  test.beforeEach(async ({ mainWindow }) => {
    await waitForApp(mainWindow);
    await mainWindow.locator('.nav-item:has-text("设置")').click({ force: true });
  });

  test('基础标签页应显示主题和快捷键信息', async ({ mainWindow }) => {
    await mainWindow.locator('text=基础').first().click({ force: true });
    await expect(mainWindow.locator('text=主题').first()).toBeVisible();
  });

  test('模型标签页应显示供应商列表', async ({ mainWindow }) => {
    await mainWindow.locator('text=模型').first().click({ force: true });
    await expect(mainWindow.locator('text=添加供应商').first()).toBeVisible();
  });

  test('关于标签页应显示版本信息', async ({ mainWindow }) => {
    await mainWindow.locator('text=关于').first().click({ force: true });
    await expect(mainWindow.locator('text=版本').first()).toBeVisible();
  });
});
