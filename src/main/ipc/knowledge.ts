import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function setupKnowledgeIpc() {
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

      const { ingestDocument } = await import('../knowledge');
      const results = [];
      for (const filePath of result.filePaths) {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_FILE_SIZE) {
          results.push({ name: path.basename(filePath), docId: '', chunks: 0, error: `文件超过 5MB 限制 (${(stat.size / 1024 / 1024).toFixed(1)}MB)` });
          continue;
        }
        const text = await fs.readFile(filePath, 'utf-8');
        const name = path.basename(filePath);
        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${path.basename(filePath, path.extname(filePath))}`;
        const res = await ingestDocument(docId, text, {
          name,
          date: new Date().toISOString(),
        });
        results.push({ name, docId, chunks: res.chunks });
      }
      return { success: true, documents: results };
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
