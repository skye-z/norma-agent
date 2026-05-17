import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  onMessage: (channel: string, callback: (data: any) => void) => () => {
    const subscription = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  hideWindow: () => {
    ipcRenderer.send('window:hide');
  },
  minimizeWindow: () => {
    ipcRenderer.send('window:minimize');
  },
  quitApp: () => {
    ipcRenderer.send('window:quit');
  },
  resizeWindow: (width: number, height: number) => {
    ipcRenderer.send('window:resize', { width, height });
  },
  platform: process.platform,

  configGet: (key: string) => ipcRenderer.invoke('config:get', key),
  configSet: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  configDelete: (key: string) => ipcRenderer.invoke('config:delete', key),
  configGetAll: () => ipcRenderer.invoke('config:getAll'),

  invokeProviderPresets: () => ipcRenderer.invoke('provider:presets'),
  testProviderConnectivity: (config: any) => ipcRenderer.invoke('provider:test', config),
  fetchProviderModels: (config: any) => ipcRenderer.invoke('provider:models', config),
  testModelAvailability: (config: any, modelId: string) => ipcRenderer.invoke('model:test', config, modelId),

  createThread: (title?: string) => ipcRenderer.invoke('memory:createThread', title),
  listThreads: () => ipcRenderer.invoke('memory:listThreads'),
  getThread: (threadId: string) => ipcRenderer.invoke('memory:getThread', threadId),
  deleteThread: (threadId: string) => ipcRenderer.invoke('memory:deleteThread', threadId),
  getThreadMessages: (threadId: string) => ipcRenderer.invoke('memory:getThreadMessages', threadId),

  getCapabilities: () => ipcRenderer.invoke('capabilities:list'),
  getAgentsList: () => ipcRenderer.invoke('agents:list'),
  getModels: () => ipcRenderer.invoke('models:list'),
  getActiveModel: () => ipcRenderer.invoke('model:getActive'),
  setActiveModel: (modelString: string, providerConfig?: { providerType: string; baseUrl: string; apiKey: string }) => ipcRenderer.invoke('model:setActive', modelString, providerConfig),
  getSystemVersion: () => ipcRenderer.invoke('system:version'),

  knowledgeIngest: (name: string, text: string) => ipcRenderer.invoke('knowledge:ingest', { name, text }),
  knowledgeIngestFile: () => ipcRenderer.invoke('knowledge:ingestFile'),
  knowledgeQuery: (query: string, topK?: number) => ipcRenderer.invoke('knowledge:query', { query, topK }),
  knowledgeList: () => ipcRenderer.invoke('knowledge:list'),
  knowledgeDelete: (docId: string) => ipcRenderer.invoke('knowledge:delete', { docId }),

  automationRun: (name: string, desc: string, trigger: string) => ipcRenderer.invoke('automation:run', { name, desc, trigger }),
  automationListWorkflows: () => ipcRenderer.invoke('automation:listWorkflows'),

  diagSetLogging: (enabled: boolean) => ipcRenderer.invoke('diag:setLogging', enabled),
  diagGetLoggingState: () => ipcRenderer.invoke('diag:getLoggingState'),
  diagGetLogs: () => ipcRenderer.invoke('diag:getLogs'),
  diagClearLogs: () => ipcRenderer.invoke('diag:clearLogs'),
  diagSubscribe: () => ipcRenderer.invoke('diag:subscribe'),
  diagUnsubscribe: () => ipcRenderer.invoke('diag:unsubscribe'),
});
