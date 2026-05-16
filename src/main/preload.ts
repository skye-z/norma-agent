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

  invokeProviderPresets: () => ipcRenderer.invoke('provider:presets'),
  testProviderConnectivity: (config: any) => ipcRenderer.invoke('provider:test', config),
  fetchProviderModels: (config: any) => ipcRenderer.invoke('provider:models', config),
  testModelAvailability: (config: any, modelId: string) => ipcRenderer.invoke('model:test', config, modelId),

  createThread: (title?: string) => ipcRenderer.invoke('memory:createThread', title),
  listThreads: () => ipcRenderer.invoke('memory:listThreads'),
  getThread: (threadId: string) => ipcRenderer.invoke('memory:getThread', threadId),
  deleteThread: (threadId: string) => ipcRenderer.invoke('memory:deleteThread', threadId),
  getThreadMessages: (threadId: string) => ipcRenderer.invoke('memory:getThreadMessages', threadId),
});
