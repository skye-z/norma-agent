import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  screen,
  ipcMain,
} from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import { setupIpc } from "./ipc";
import { initConfig, getConfig, setConfig } from "./config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch("enable-features", "CSSBackdropFilter");
app.commandLine.appendSwitch("no-sandbox");

let mainWindow: BrowserWindow | null = null;
let commandBarWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const DEFAULT_SHORTCUTS = {
  commandBar: process.platform === 'darwin' ? 'Option+Space' : 'Ctrl+Shift+Space',
  newSession: process.platform === 'darwin' ? 'Cmd+N' : 'Ctrl+N',
  hideWindow: process.platform === 'darwin' ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
};

let currentShortcuts = { ...DEFAULT_SHORTCUTS };

const isTestMode =
  !!process.env.PLAYWRIGHT_TEST || !!process.env.NODE_ENV?.includes("test");
const gotTheLock = isTestMode || app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showWindow();
  });

  app.whenReady().then(async () => {
    await initConfig(app.getPath("userData"));
    await setupIpc();
    createTray();
    createWindow();
    createCommandBarWindow();

    const { initAgent } = await import("./agent");
    const { getConfig } = await import("./config");
    const savedModel = await getConfig("norma-active-model");
    initAgent(
      app.getPath("userData"),
      typeof savedModel === "string" ? savedModel : undefined,
    ).catch((err) => {
      console.error("[Agent] Failed to initialize:", err);
    });

    const savedShortcuts = await getConfig('norma:shortcuts');
    const shortcuts = savedShortcuts && typeof savedShortcuts === 'object'
      ? { ...DEFAULT_SHORTCUTS, ...(savedShortcuts as Partial<typeof DEFAULT_SHORTCUTS>) }
      : { ...DEFAULT_SHORTCUTS };
    registerAllShortcuts(shortcuts);

    ipcMain.handle('shortcuts:get', () => currentShortcuts);
    ipcMain.handle('shortcuts:set', async (_event, s: Partial<typeof DEFAULT_SHORTCUTS>) => {
      const merged = { ...currentShortcuts, ...s };
      await setConfig('norma:shortcuts', merged);
      registerAllShortcuts(merged);
      return { success: true };
    });
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("Norma Agent");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示窗口", click: showWindow },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", showWindow);
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function toggleCommandBar() {
  if (!commandBarWindow) {
    createCommandBarWindow();
  }
  if (commandBarWindow) {
    if (commandBarWindow.isVisible()) {
      commandBarWindow.hide();
    } else {
      commandBarWindow.show();
      commandBarWindow.focus();
    }
  }
}

function createWindow() {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 520,
    transparent: isMac,
    vibrancy: "sidebar",
    visualEffectState: "active",
    backgroundMaterial: "acrylic",
    frame: false,
    titleBarStyle: isMac ? "hidden" : undefined,
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
    hasShadow: false,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
}

function createCommandBarWindow() {
  const isMac = process.platform === "darwin";
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const winWidth = 680;
  const winHeight = 56;
  const x = Math.round((screenWidth - winWidth) / 2);
  const y = Math.round(primaryDisplay.workAreaSize.height * 0.15);

  commandBarWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    transparent: true,
    vibrancy: "hud",
    visualEffectState: "active",
    frame: false,
    hasShadow: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  commandBarWindow.on("blur", () => {
    commandBarWindow?.hide();
  });

  commandBarWindow.on("closed", () => {
    commandBarWindow = null;
  });

  if (process.env.NODE_ENV === "development") {
    commandBarWindow.loadURL("http://localhost:5173/#/command");
  } else {
    commandBarWindow.loadURL(
      `file://${path.join(__dirname, "../renderer/index.html")}#/command`,
    );
  }
}

function registerAllShortcuts(shortcuts: typeof DEFAULT_SHORTCUTS) {
  globalShortcut.unregisterAll();
  try { globalShortcut.register(shortcuts.commandBar, () => { toggleCommandBar(); }); } catch {}
  try {
    globalShortcut.register(shortcuts.newSession, async () => {
      try {
        const { getMemory } = await import("./agent");
        const memory = getMemory();
        if (memory) {
          const thread = await memory.createThread({ resourceId: 'norma-user', title: '新会话' });
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send('shortcut:newSession', thread.id);
          }
        }
      } catch {}
    });
  } catch {}
  try {
    globalShortcut.register(shortcuts.hideWindow, () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) mainWindow.hide();
        else { mainWindow.show(); mainWindow.focus(); }
      }
    });
  } catch {}
  currentShortcuts = { ...shortcuts };
}

app.on("activate", function () {
  showWindow();
});

app.on("before-quit", () => {
  mainWindow?.removeAllListeners("close");
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", function () {});
