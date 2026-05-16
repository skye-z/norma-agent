import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WorkerFixtures = {
  app: ElectronApplication;
  mainWindow: Page;
};

export const test = base.extend<{}, WorkerFixtures>({
  app: [async ({}, use) => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '..', '..')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PLAYWRIGHT_TEST: '1',
        OPENAI_API_KEY: '',
      },
    });

    await use(electronApp);
    await electronApp.close();
  }, { scope: 'worker' }],

  mainWindow: [async ({ app }, use) => {
    // 等待至少两个窗口加载
    while (app.windows().length < 2) {
      await new Promise(r => setTimeout(r, 500));
    }
    
    // 严格过滤：主窗口的宽度肯定大于 700 (命令栏只有 680)
    let main: Page | undefined;
    for (const w of app.windows()) {
      const size = await w.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })).catch(() => ({w: 0, h: 0}));
      if (size.w > 700) {
        main = w;
        break;
      }
    }
    
    if (!main) {
      main = app.windows()[0];
    }

    await main.waitForLoadState('domcontentloaded');
    // 等待后台 agent 初始化完成 (避免 Memory not initialized 错误)
    await main.waitForTimeout(4000); 
    await use(main);
  }, { scope: 'worker' }],
});

export { expect };
