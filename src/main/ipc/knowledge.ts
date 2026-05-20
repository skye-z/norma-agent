import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const LOG_FILE = path.join(os.homedir(), 'AppData', 'Roaming', 'norma-agent', 'model-download.log');
function logToFile(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  fs.appendFile(LOG_FILE, line).catch(() => {});
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function setupKnowledgeIpc() {
  ipcMain.handle('knowledge:status', async () => {
    try {
      const { getEmbedderStatus } = await import('../knowledge');
      return getEmbedderStatus();
    } catch {
      return { configured: false, mode: 'remote' };
    }
  });

  ipcMain.handle('knowledge:setMode', async (_event, mode: 'remote' | 'local') => {
    try {
      const { setEmbedderMode } = await import('../knowledge');
      setEmbedderMode(mode);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:loadModel', async () => {
    logToFile('[IPC] knowledge:loadModel called');
    try {
      const { loadLocalModel, getLocalModelStatus } = await import('../knowledge');
      logToFile('[IPC] knowledge module imported, calling loadLocalModel...');
      await loadLocalModel();
      logToFile('[IPC] loadLocalModel completed');
      return { success: true, ...getLocalModelStatus() };
    } catch (err: any) {
      logToFile(`[IPC] loadLocalModel error: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:modelStatus', async () => {
    try {
      const { getLocalModelStatus } = await import('../knowledge');
      return getLocalModelStatus();
    } catch {
      return { ready: false, downloading: false, progress: 0, modelPath: '' };
    }
  });

  ipcMain.handle('knowledge:deleteModel', async () => {
    try {
      const { deleteLocalModel } = await import('../knowledge');
      await deleteLocalModel();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:ingest', async (event, { name, text }: { name: string; text: string }) => {
    try {
      const { ingestDocument } = await import('../knowledge');
      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await ingestDocument(docId, text, {
        name,
        date: new Date().toISOString(),
      });
      return { success: true, docId, chunks: result.chunks };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:ingestFile', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Documents', extensions: ['txt', 'md', 'json', 'csv', 'html'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'cancelled' };
      }

      const fileInfos = [];
      for (const filePath of result.filePaths) {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_FILE_SIZE) {
          fileInfos.push({ path: filePath, name: path.basename(filePath), size: stat.size, tooLarge: true });
        } else {
          fileInfos.push({ path: filePath, name: path.basename(filePath), size: stat.size, tooLarge: false });
        }
      }
      return { success: true, files: fileInfos };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:ingestFilePath', async (_event, { filePath, name }: { filePath: string; name: string }) => {
    try {
      const { ingestDocument } = await import('../knowledge');
      const text = await fs.readFile(filePath, 'utf-8');
      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${path.basename(filePath, path.extname(filePath))}`;
      const result = await ingestDocument(docId, text, {
        name,
        date: new Date().toISOString(),
      });
      return { success: true, docId, chunks: result.chunks };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:query', async (_event, { query, topK }: { query: string; topK?: number }) => {
    try {
      const { queryKnowledge } = await import('../knowledge');
      const results = await queryKnowledge(query, topK);
      return { success: true, results };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('knowledge:list', async () => {
    try {
      const { listDocuments } = await import('../knowledge');
      const docs = await listDocuments();
      return { success: true, documents: docs };
    } catch (err: any) {
      return { success: false, error: err.message, documents: [] };
    }
  });

  ipcMain.handle('knowledge:delete', async (_event, { docId }: { docId: string }) => {
    try {
      const { deleteDocument } = await import('../knowledge');
      await deleteDocument(docId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
