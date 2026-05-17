import { ipcMain } from 'electron';

export function setupAutomationIpc() {
  ipcMain.handle('automation:run', async (_event, { name, desc, trigger }: { name: string; desc: string; trigger: string }) => {
    try {
      const { getMastra } = await import('../agent');
      const mastra = getMastra();
      const workflow = mastra.getWorkflow('automationWorkflow');
      const run = await workflow.createRun();
      const result = await run.start({ inputData: { name, desc, trigger } });
      return {
        success: result.status === 'success',
        status: (result as any).status,
        output: (result as any).result,
        timestamp: (result as any).timestamp,
        error: result.status === 'failed' ? (result as any).error?.message : undefined,
      };
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
}
