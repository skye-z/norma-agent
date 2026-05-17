import { ipcMain } from 'electron';
import { setConfig, getConfig } from '../config';

const MAX_LOG_ENTRIES = 2000;
const LOG_KEY = 'norma-diag-logs';
let logBuffer: Array<{ ts: string; level: string; source: string; message: string }> = [];
let loggingEnabled = false;
let logSubscribers: Set<number> = new Set();
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function timestamp(): string {
  return new Date().toISOString();
}

async function flushLogs() {
  if (!dirty) return;
  dirty = false;
  try {
    await setConfig(LOG_KEY, logBuffer.slice(-MAX_LOG_ENTRIES));
  } catch {}
}

async function loadLogs() {
  try {
    const stored = await getConfig(LOG_KEY);
    if (Array.isArray(stored)) {
      logBuffer = stored.slice(-MAX_LOG_ENTRIES);
    }
  } catch {}
}

export function isLoggingEnabled(): boolean {
  return loggingEnabled;
}

export function appendLog(level: string, source: string, message: string) {
  if (!loggingEnabled) return;
  const entry = { ts: timestamp(), level, source, message };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer = logBuffer.slice(-MAX_LOG_ENTRIES);
  }
  dirty = true;
  if (!flushTimer) {
    flushTimer = setTimeout(() => { flushTimer = null; flushLogs(); }, 2000);
  }
  const raw = JSON.stringify(entry);
  for (const webContentsId of logSubscribers) {
    try {
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.getAllWindows().find((w: any) => w.webContents.id === webContentsId);
      if (win && !win.isDestroyed()) {
        win.webContents.send('diag:logEntry', raw);
      }
    } catch {}
  }
}

export function setupDiagIpc() {
  loadLogs();

  ipcMain.handle('diag:setLogging', async (_event, enabled: boolean) => {
    loggingEnabled = enabled;
    if (enabled) logBuffer = [];
    return { enabled };
  });

  ipcMain.handle('diag:getLoggingState', () => {
    return { enabled: loggingEnabled };
  });

  ipcMain.handle('diag:getLogs', () => {
    return logBuffer;
  });

  ipcMain.handle('diag:clearLogs', async () => {
    logBuffer = [];
    dirty = true;
    await flushLogs();
    return true;
  });

  ipcMain.handle('diag:subscribe', (event) => {
    const id = event.sender.id;
    logSubscribers.add(id);
    return true;
  });

  ipcMain.handle('diag:unsubscribe', (event) => {
    logSubscribers.delete(event.sender.id);
    return true;
  });
}
