import { ipcMain } from 'electron';
import { setConfig, getConfig } from '../config';

export function setupAutomationIpc() {
  ipcMain.handle('automation:run', async (_event, { name, desc, trigger }: { name: string; desc: string; trigger: string }) => {
    try {
      const { getMastra } = await import('../agent');
      const mastra = getMastra();
      const workflow = mastra.getWorkflow('automationWorkflow');
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { name, desc, trigger } });
      const output = {
        success: result.status === 'success',
        status: (result as any).status,
        output: (result as any).result,
        timestamp: new Date().toISOString(),
      };

      try {
        const historyRaw = await getConfig('norma-automation-history');
        const history: any[] = Array.isArray(historyRaw) ? historyRaw : [];
        history.push({ name, desc, trigger, ...output, ts: new Date().toISOString() });
        if (history.length > 100) history.splice(0, history.length - 100);
        await setConfig('norma-automation-history', history);
      } catch {}

      return output;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('automation:listWorkflows', async () => {
    try {
      const { getMastra } = await import('../agent');
      const mastra = getMastra();
      const workflows = mastra.listWorkflows();
      return {
        success: true,
        workflows: Object.entries(workflows).map(([id, wf]: [string, any]) => ({
          id,
          name: wf.name || id,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err.message, workflows: [] };
    }
  });

  ipcMain.handle('automation:history', async () => {
    try {
      const historyRaw = await getConfig('norma-automation-history');
      return Array.isArray(historyRaw) ? historyRaw : [];
    } catch {
      return [];
    }
  });
}
