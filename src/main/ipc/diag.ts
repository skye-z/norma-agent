import { ipcMain } from 'electron';

const MAX_LOG_ENTRIES = 2000;
let logBuffer: Array<{ ts: string; level: string; source: string; message: string }> = [];
let loggingEnabled = false;
let logSubscribers: Set<number> = new Set();

function timestamp(): string {
  return new Date().toISOString();
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
  ipcMain.handle('diag:setLogging', (_event, enabled: boolean) => {
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

  ipcMain.handle('diag:clearLogs', () => {
    logBuffer = [];
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
