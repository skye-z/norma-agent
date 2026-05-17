import { ipcMain } from 'electron';
import { getConfig, setConfig, deleteConfig, getAllConfig } from '../config';

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
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:delete', async (_event, key: string) => {
    try {
      await deleteConfig(key);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('config:getAll', async () => {
    try {
      return await getAllConfig();
    } catch {
      return {};
    }
  });
}
