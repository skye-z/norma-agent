import { ipcMain, BrowserWindow } from 'electron';
import { getConfig, setConfig, deleteConfig, getAllConfig } from '../config';

function sanitizeObject(obj: Record<string, any>, sensitiveKeys: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      result[key] = '***';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, sensitiveKeys);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function setupConfigIpc() {
  ipcMain.handle('config:get', async (_event, key: string) => {
    try {
      return await getConfig(key);
    } catch {
      return null;
    }
  });

  ipcMain.handle('config:set', async (_event, key: string, value: any) => {
    try {
      await setConfig(key, value);
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('config:changed', key);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:delete', async (_event, key: string) => {
    try {
      await deleteConfig(key);
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('config:changed', key);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:getAll', async () => {
    try {
      const all = await getAllConfig();
      const SENSITIVE_SUFFIXES = ['apiKey', 'ApiKey', 'api_key', 'secret', 'password', 'token'];
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(all)) {
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitizeObject(value, SENSITIVE_SUFFIXES);
        } else if (SENSITIVE_SUFFIXES.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
          sanitized[key] = '***';
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    } catch {
      return {};
    }
  });
}
