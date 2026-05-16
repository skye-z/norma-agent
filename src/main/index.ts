import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  screen,
} from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import { setupIpc } from "./ipc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch("enable-features", "CSSBackdropFilter");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

let mainWindow: BrowserWindow | null = null;
let commandBarWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isTestMode = !!process.env.PLAYWRIGHT_TEST || !!process.env.NODE_ENV?.includes('test');
const gotTheLock = isTestMode || app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showWindow();
  });

  app.whenReady().then(async () => {
    setupIpc();
    createTray();
    createWindow();
    createCommandBarWindow();

    const { initAgent } = await import('./agent');
    initAgent(app.getPath('userData')).catch((err) => {
      console.error('[Agent] Failed to initialize:', err);
    });

    const isMac = process.platform === "darwin";
    const shortcut = isMac ? "Option+Space" : "Ctrl+Shift+Space";
    globalShortcut.register(shortcut, () => {
      toggleCommandBar();
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

app.on("activate", function () {
  showWindow();
});

app.on("before-quit", () => {
  mainWindow?.removeAllListeners("close");
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", function () {});
