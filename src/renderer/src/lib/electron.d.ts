declare global {
  interface Window {
    electronAPI: {
      sendMessage: (channel: string, data: any) => void;
      onMessage: (channel: string, callback: (data: any) => void) => () => void;
      hideWindow: () => void;
      minimizeWindow: () => void;
      quitApp: () => void;
      resizeWindow: (width: number, height: number) => void;
      platform: string;
      invokeProviderPresets: () => Promise<any[]>;
      testProviderConnectivity: (config: any) => Promise<{ success: boolean; error?: string; latency?: number }>;
      fetchProviderModels: (config: any) => Promise<{ success: boolean; models?: any[]; error?: string }>;
      testModelAvailability: (config: any, modelId: string) => Promise<{ success: boolean; error?: string; response?: string; latency?: number }>;
      createThread: (title?: string) => Promise<{ id: string; title: string; resourceId: string; createdAt: string; updatedAt: string }>;
      listThreads: () => Promise<Array<{ id: string; title: string; resourceId: string; createdAt: string; updatedAt: string }>>;
      getThread: (threadId: string) => Promise<{ id: string; title: string; resourceId: string; createdAt: string; updatedAt: string } | null>;
      deleteThread: (threadId: string) => Promise<boolean>;
      getThreadMessages: (threadId: string) => Promise<any[]>;
    };
  }
}
