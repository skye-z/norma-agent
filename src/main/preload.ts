import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  chatSend: (data: string | { message: string; threadId?: string }) => {
    ipcRenderer.send('chat:send', data);
  },
  onChatChunk: (callback: (data: string) => void) => {
    const handler = (_event: any, data: string) => callback(data);
    ipcRenderer.on('chat:chunk', handler);
    return () => { ipcRenderer.removeListener('chat:chunk', handler); };
  },
  onChatDone: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('chat:done', handler);
    return () => { ipcRenderer.removeListener('chat:done', handler); };
  },
  onChatError: (callback: (err: string) => void) => {
    const handler = (_event: any, err: string) => callback(err);
    ipcRenderer.on('chat:error', handler);
    return () => { ipcRenderer.removeListener('chat:error', handler); };
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

  onConfigChanged: (callback: (key: string) => void) => {
    const handler = (_event: any, key: string) => callback(key);
    ipcRenderer.on('config:changed', handler);
    return () => { ipcRenderer.removeListener('config:changed', handler); };
  },

  cancelChat: () => ipcRenderer.invoke('chat:cancel'),

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
  testTool: (toolId: string, userArgs?: Record<string, any>) => ipcRenderer.invoke('tool:test', toolId, userArgs),
  getToolInputFields: (toolId: string) => ipcRenderer.invoke('tool:inputFields', toolId),
  getAgentsList: () => ipcRenderer.invoke('agents:list'),
  getModels: () => ipcRenderer.invoke('models:list'),
  getActiveModel: () => ipcRenderer.invoke('model:getActive'),
  setActiveModel: (modelString: string, providerConfig?: { providerType: string; baseUrl: string; apiKey: string }) => ipcRenderer.invoke('model:setActive', modelString, providerConfig),
  getModelCapabilities: (modelId: string) => ipcRenderer.invoke('model:capabilities', modelId),
  getModelDisplayName: (modelId: string) => ipcRenderer.invoke('model:displayName', modelId),
  getCapabilitiesWithOverride: (modelId: string) => ipcRenderer.invoke('model:capabilitiesWithOverride', modelId),
  getSystemVersion: () => ipcRenderer.invoke('system:version'),

  knowledgeIngest: (name: string, text: string) => ipcRenderer.invoke('knowledge:ingest', { name, text }),
  knowledgeIngestFile: () => ipcRenderer.invoke('knowledge:ingestFile'),
  knowledgeQuery: (query: string, topK?: number) => ipcRenderer.invoke('knowledge:query', { query, topK }),
  knowledgeList: () => ipcRenderer.invoke('knowledge:list'),
  knowledgeDelete: (docId: string) => ipcRenderer.invoke('knowledge:delete', { docId }),

  automationRun: (name: string, desc: string, trigger: string) => ipcRenderer.invoke('automation:run', { name, desc, trigger }),
  automationListWorkflows: () => ipcRenderer.invoke('automation:listWorkflows'),
  automationHistory: () => ipcRenderer.invoke('automation:history'),

  diagSetLogging: (enabled: boolean) => ipcRenderer.invoke('diag:setLogging', enabled),
  diagGetLoggingState: () => ipcRenderer.invoke('diag:getLoggingState'),
  diagGetLogs: () => ipcRenderer.invoke('diag:getLogs'),
  diagClearLogs: () => ipcRenderer.invoke('diag:clearLogs'),
  diagSubscribe: () => ipcRenderer.invoke('diag:subscribe'),
  diagUnsubscribe: () => ipcRenderer.invoke('diag:unsubscribe'),

  speechAvailable: () => ipcRenderer.invoke('speech:available'),
  speechStart: (timeoutSec?: number) => ipcRenderer.invoke('speech:start', timeoutSec),
  speechStop: () => ipcRenderer.invoke('speech:stop'),
  speechRecognize: (timeoutSec?: number) => ipcRenderer.invoke('speech:recognize', timeoutSec),
  onSpeechPartial: (cb: (data: { confidence: number; text: string }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('speech:partial', handler);
    return () => { ipcRenderer.removeListener('speech:partial', handler); };
  },
  onSpeechResult: (cb: (data: { success: boolean; confidence: number; text: string }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('speech:result', handler);
    return () => { ipcRenderer.removeListener('speech:result', handler); };
  },
  onSpeechDone: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('speech:done', handler);
    return () => { ipcRenderer.removeListener('speech:done', handler); };
  },
  onSpeechError: (cb: (err: string) => void) => {
    const handler = (_e: any, err: string) => cb(err);
    ipcRenderer.on('speech:error', handler);
    return () => { ipcRenderer.removeListener('speech:error', handler); };
  },
});
