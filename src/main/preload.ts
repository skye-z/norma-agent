import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // IPC methods will be added here
});
